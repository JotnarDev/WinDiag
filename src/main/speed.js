import { parseJsonArray, runPowerShell } from './powershell'
import { runActionScript } from './elevated'

/*
 * The home edition's Speed up page: apps that start with Windows, cleaning
 * up temporary files, and the power mode. Some of it follows the tweaks in
 * Chris Titus Tech's WinUtil (MIT licence, © 2022 CT Tech Group LLC),
 * written again here.
 */

const isWindows = process.platform === 'win32'

function requireWindows() {
  if (!isWindows) throw new Error('Only available on Windows')
}

/* --- Startup apps ---------------------------------------------------------- */

// Where Windows starts apps from. An app is turned off the way Task Manager
// and Settings do it, in StartupApproved (first byte odd = off), so either of
// them can turn it back on.
const STARTUP_SOURCES = {
  'user-run': {
    hive: 'HKCU:',
    key: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run',
    list: 'Run',
    admin: false
  },
  'machine-run': {
    hive: 'HKLM:',
    key: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run',
    list: 'Run',
    admin: true
  },
  'machine-run32': {
    hive: 'HKLM:',
    key: 'Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run',
    list: 'Run32',
    admin: true
  },
  'user-folder': { hive: 'HKCU:', folder: 'Startup', list: 'StartupFolder', admin: false },
  'common-folder': { hive: 'HKLM:', folder: 'CommonStartup', list: 'StartupFolder', admin: true }
}

const psString = (value) => `'${String(value).replace(/'/g, "''")}'`

const sourcesTable = Object.entries(STARTUP_SOURCES)
  .map(
    ([id, s]) =>
      `@{ Source = ${psString(id)}; Hive = ${psString(s.hive)}; Key = ${psString(s.key ?? '')}; Folder = ${psString(s.folder ?? '')}; List = ${psString(s.list)} }`
  )
  .join(',\n    ')

const STARTUP_LIST_SCRIPT =
  String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$approved = 'Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved'
function Test-Approved($hive, $list, $name) {
    $value = (Get-ItemProperty -Path "$hive\$approved\$list" -Name $name).$name
    if ($value -is [byte[]] -and $value.Length -gt 0) { return (($value[0] -band 1) -eq 0) }
    return $true
}
function Get-Target([string]$command) {
    if ($command -match '^\s*"([^"]+)"') { return $Matches[1] }
    if ($command -match '^\s*(.+?\.(exe|cmd|bat|lnk))\b') { return $Matches[1] }
    return ($command -split '\s+')[0]
}
$shell = New-Object -ComObject WScript.Shell
$items = @()
$sources = @(
    ` +
  sourcesTable +
  String.raw`
)
foreach ($s in $sources) {
    $entries = @()
    if ($s.Key) {
        $item = Get-Item -Path "$($s.Hive)\$($s.Key)"
        if (-not $item) { continue }
        foreach ($name in $item.GetValueNames()) {
            if (-not $name) { continue }
            $command = [string]$item.GetValue($name)
            $entries += @{ Name = $name; Command = $command; Target = (Get-Target $command) }
        }
    } else {
        $folder = [Environment]::GetFolderPath($s.Folder)
        Get-ChildItem -LiteralPath $folder -File -Force | Where-Object { $_.Name -ne 'desktop.ini' } | ForEach-Object {
            $target = if ($_.Extension -eq '.lnk') { $shell.CreateShortcut($_.FullName).TargetPath } else { $_.FullName }
            $entries += @{ Name = $_.Name; Command = $target; Target = $target }
        }
    }
    foreach ($e in $entries) {
        $target = if ($e.Target) { [Environment]::ExpandEnvironmentVariables($e.Target) } else { $null }
        $missing = $false
        if ($target -and -not [IO.Path]::IsPathRooted($target)) {
            # A bare name such as rundll32.exe: Windows finds it on the PATH
            $found = Get-Command -Name $target -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            $target = if ($found) { $found.Source } else { $null }
        } elseif ($target) {
            $missing = -not (Test-Path -LiteralPath $target)
        }
        $exists = $target -and -not $missing
        $info = if ($exists) { (Get-Item -LiteralPath $target -Force).VersionInfo } else { $null }
        $items += [PSCustomObject]@{
            Source = $s.Source
            Name = [string]$e.Name
            Command = [string]$e.Command
            Path = $target
            Missing = $missing
            Description = if ($info) { [string]$info.FileDescription } else { $null }
            Company = if ($info) { [string]$info.CompanyName } else { $null }
            Enabled = (Test-Approved $s.Hive $s.List $e.Name)
        }
    }
}
ConvertTo-Json -InputObject @($items) -Compress
`

const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/** Apps that start with Windows, on or off. */
export async function getStartupApps() {
  requireWindows()
  const items = parseJsonArray(await runPowerShell(STARTUP_LIST_SCRIPT, 30e3))
  return items.map((item) => {
    const source = STARTUP_SOURCES[item.Source]
    const fileName = String(item.Name).replace(/\.(lnk|url|exe)$/i, '')
    return {
      id: `${item.Source}|${item.Name}`,
      name: clean(item.Description) ?? fileName,
      entryName: String(item.Name),
      company: clean(item.Company),
      path: clean(item.Path),
      command: clean(item.Command),
      missing: Boolean(item.Missing),
      enabled: Boolean(item.Enabled),
      forEveryone: source?.admin ?? false
    }
  })
}

/** Turns one startup app on or off; apps for every user ask for admin rights. */
export async function setStartupApp(id, enabled) {
  requireWindows()
  const separator = id.indexOf('|')
  const sourceId = id.slice(0, separator)
  const name = id.slice(separator + 1)
  const source = STARTUP_SOURCES[sourceId]
  if (separator < 1 || !source || !name || name.length > 260) throw new Error('Unknown startup app')
  if (source.folder && /[\\/]|^\.\.?$/.test(name)) throw new Error('Unknown startup app')

  const encodedName = Buffer.from(name, 'utf8').toString('base64')
  const exists = source.key
    ? `if ($null -eq (Get-Item -Path ${psString(`${source.hive}\\${source.key}`)}).GetValue($name)) { throw 'This app no longer starts with Windows.' }`
    : `if (-not (Test-Path -LiteralPath (Join-Path ([Environment]::GetFolderPath(${psString(source.folder)})) $name))) { throw 'This app no longer starts with Windows.' }`
  const script = `
$name = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedName}'))
${exists}
$path = ${psString(`${source.hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\${source.list}`)}
if (-not (Test-Path -Path $path)) { New-Item -Path $path -Force | Out-Null }
$bytes = if (${enabled ? '$true' : '$false'}) {
    [byte[]](2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
} else {
    [byte[]]((3, 0, 0, 0) + [BitConverter]::GetBytes([DateTime]::UtcNow.ToFileTimeUtc()))
}
New-ItemProperty -Path $path -Name $name -Value $bytes -PropertyType Binary -Force | Out-Null
'done'
`
  return runActionScript(script, {
    admin: source.admin,
    label: `Turning ${enabled ? 'on' : 'off'} the startup app “${name}”`
  })
}

/* --- Clean up -------------------------------------------------------------- */

// Files older than a day only: newer ones may belong to an installer or an
// app that is running. Links and junctions are never followed, so nothing
// outside these folders is touched.
const OLD_FILES_FUNCTION = String.raw`
$cutoff = (Get-Date).AddDays(-1)
function Get-OldFiles([string]$root) {
    if (-not $root -or -not (Test-Path -LiteralPath $root)) { return }
    $stack = New-Object System.Collections.Stack
    $stack.Push($root)
    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        foreach ($entry in (Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
            if ($entry.PSIsContainer) { $stack.Push($entry.FullName) }
            elseif ($entry.LastWriteTime -lt $cutoff) { $entry }
        }
    }
}
function Measure-Files($files) {
    $bytes = [int64]0; $count = 0
    foreach ($f in $files) { $bytes += $f.Length; $count++ }
    @{ bytes = $bytes; files = $count }
}
function Remove-Files($files) {
    $freed = [int64]0; $skipped = 0
    foreach ($f in $files) {
        $length = $f.Length
        try { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop; $freed += $length } catch { $skipped++ }
    }
    @{ bytes = $freed; skipped = $skipped }
}
function Get-RecycleBinFiles {
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    foreach ($drive in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) {
        $bin = Join-Path $drive.Root ('$Recycle.Bin\' + $sid)
        if (Test-Path -LiteralPath $bin) {
            Get-ChildItem -LiteralPath $bin -Recurse -Force -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -ne 'desktop.ini' }
        }
    }
}
`

const CLEANUP_SCAN_SCRIPT =
  OLD_FILES_FUNCTION +
  String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$bin = Measure-Files (Get-RecycleBinFiles)
ConvertTo-Json -Compress -InputObject @{
    userTemp = Measure-Files (Get-OldFiles $env:TEMP)
    windowsTemp = Measure-Files (Get-OldFiles (Join-Path $env:SystemRoot 'Temp'))
    recycleBin = $bin
}
`

/** How much each clean-up would free, in bytes. */
export async function scanCleanup() {
  requireWindows()
  const result = JSON.parse(await runPowerShell(CLEANUP_SCAN_SCRIPT, 120e3))
  return {
    userTemp: result.userTemp,
    // Without admin rights some of it can't be read, so this is a minimum
    windowsTemp: result.windowsTemp,
    recycleBin: result.recycleBin
  }
}

const CLEANUP_SCRIPTS = {
  userTemp: { admin: false, script: 'Remove-Files @(Get-OldFiles $env:TEMP)' },
  windowsTemp: {
    admin: true,
    script: "Remove-Files @(Get-OldFiles (Join-Path $env:SystemRoot 'Temp'))"
  },
  recycleBin: {
    admin: false,
    script: `$size = Measure-Files (Get-RecycleBinFiles)
Clear-RecycleBin -Force -ErrorAction SilentlyContinue
$left = Measure-Files (Get-RecycleBinFiles)
@{ bytes = $size.bytes - $left.bytes; skipped = $left.files }`
  }
}

/** Cleans one place ('userTemp', 'windowsTemp' or 'recycleBin'). */
export async function runCleanup(id) {
  requireWindows()
  const job = CLEANUP_SCRIPTS[id]
  if (!job) throw new Error(`Unknown clean-up: ${id}`)
  return runActionScript(OLD_FILES_FUNCTION + job.script, {
    admin: job.admin,
    timeoutMs: 300e3,
    label: `Clean-up of ${id}`
  })
}

/* --- Power mode ------------------------------------------------------------ */

// The power mode in Settings > System > Power is an overlay on the Balanced
// plan; with another plan active, Windows offers no modes.
const BALANCED_PLAN = '381b4222-f694-41f0-9685-ff5bb260df2e'
const POWER_MODES = {
  efficiency: '961cc777-2547-4f9d-8174-7d86181b8a7a',
  balanced: '00000000-0000-0000-0000-000000000000',
  performance: 'ded574b5-45a0-4f42-8737-46345c09c238'
}

const POWER_TYPE = String.raw`
if (-not ('WinDiag.PowerOverlay' -as [type])) {
    Add-Type -Namespace WinDiag -Name PowerOverlay -MemberDefinition @'
[DllImport("powrprof.dll")] public static extern uint PowerGetEffectiveOverlayScheme(out Guid scheme);
[DllImport("powrprof.dll")] public static extern uint PowerSetActiveOverlayScheme(Guid scheme);
'@
}
`

const POWER_GET_SCRIPT =
  POWER_TYPE +
  String.raw`
$line = [string](powercfg /getactivescheme)
$plan = if ($line -match '([0-9a-fA-F-]{36})') { $Matches[1].ToLower() } else { $null }
$planName = if ($line -match '\(([^)]+)\)\s*$') { $Matches[1] } else { $null }
$overlay = [Guid]::Empty
$code = [WinDiag.PowerOverlay]::PowerGetEffectiveOverlayScheme([ref]$overlay)
ConvertTo-Json -Compress -InputObject @{
    plan = $plan; planName = $planName
    overlay = if ($code -eq 0) { $overlay.ToString() } else { $null }
}
`

/** The active power plan and mode. */
export async function getPowerMode() {
  requireWindows()
  const result = JSON.parse(await runPowerShell(POWER_GET_SCRIPT, 15e3))
  const mode = Object.keys(POWER_MODES).find((m) => POWER_MODES[m] === result.overlay) ?? null
  return {
    planName: result.planName,
    balancedPlan: result.plan === BALANCED_PLAN,
    // Windows reports a mode only when the modes apply to the active plan
    modesAvailable: result.overlay !== null,
    mode
  }
}

/** Sets the power mode, like the slider in Settings. */
export async function setPowerMode(mode) {
  requireWindows()
  const guid = POWER_MODES[mode]
  if (!guid) throw new Error(`Unknown power mode: ${mode}`)
  const script =
    POWER_TYPE +
    `$code = [WinDiag.PowerOverlay]::PowerSetActiveOverlayScheme([Guid]'${guid}')
if ($code -ne 0) { throw "Windows didn't accept the power mode (error $code)." }
'done'`
  return runActionScript(script, { admin: false, label: `Setting the power mode to ${mode}` })
}
