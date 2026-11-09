import { spawn } from 'child_process'
import { mkdtemp, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { shell } from 'electron'
import { runActionScript, runElevatedPowerShell } from './elevated'
import { restartExplorer } from './privacy'
import { restorePointScript } from './restore-point'
import { logError } from './log'

/*
 * The home edition's Repair page: the fixes a technician would try first,
 * one at a time. Long ones (system files) report their progress through
 * 'repair:progress' events, so the page can follow along or come back to it.
 */

const isWindows = process.platform === 'win32'

function requireWindows() {
  if (!isWindows) throw new Error('Only available on Windows')
}

const systemRoot = () => process.env.SystemRoot ?? 'C:\\Windows'
const psString = (value) => `'${String(value).replace(/'/g, "''")}'`

/* --- System files ---------------------------------------------------------- */

// DISM repairs Windows' own copy of its files, then SFC checks every system
// file against it. Their output goes to files WinDiag reads for the
// percentage; SFC's verdict comes from CBS.log, which is always in English.
const systemFilesScript = (dir) => String.raw`
$dir = ${psString(dir)}
function Step($data) { Add-Content -LiteralPath "$dir\progress.jsonl" -Value (ConvertTo-Json -InputObject $data -Compress) -Encoding UTF8 }

Step @{ phase = 'dism' }
$p = Start-Process -FilePath "$env:SystemRoot\System32\dism.exe" -ArgumentList '/Online', '/Cleanup-Image', '/RestoreHealth' -RedirectStandardOutput "$dir\dism.txt" -NoNewWindow -Wait -PassThru
$dism = $p.ExitCode

Step @{ phase = 'sfc' }
$start = Get-Date
$p = Start-Process -FilePath "$env:SystemRoot\System32\sfc.exe" -ArgumentList '/scannow' -RedirectStandardOutput "$dir\sfc.txt" -NoNewWindow -Wait -PassThru
$sfc = $p.ExitCode

$repaired = 0
$unrepaired = 0
try {
    $stream = [IO.File]::Open("$env:SystemRoot\Logs\CBS\CBS.log", 'Open', 'Read', 'ReadWrite')
    $reader = New-Object IO.StreamReader($stream)
    while ($null -ne ($line = $reader.ReadLine())) {
        if ($line -notmatch '\[SR\]') { continue }
        if ($line -match '^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})' -and [datetime]$matches[1] -lt $start.AddSeconds(-5)) { continue }
        if ($line -match 'Cannot repair member file') { $unrepaired++ }
        elseif ($line -match 'Repairing corrupted file') { $repaired++ }
    }
    $reader.Close()
} catch {}
@{ dism = $dism; sfc = $sfc; repaired = $repaired; unrepaired = $unrepaired }
`

const DISM_ERRORS = {
  0x800f081f:
    'Windows couldn’t find the files it needs to repair itself. Check your internet connection and try again; if it keeps failing, Windows may need to be reinstalled with the Media Creation Tool.',
  0x800f0906: 'Windows couldn’t download the files it needs. Check your internet connection.',
  0x800f0907: 'A group policy stops Windows from downloading repair files.',
  0x800f0954: 'A group policy stops Windows from downloading repair files.'
}

/** Reads the last percentage DISM or SFC has written (SFC writes UTF-16). */
async function readPercent(file) {
  let buffer
  try {
    buffer = await readFile(file)
  } catch {
    return null
  }
  const utf16 = buffer.length > 4 && buffer.subarray(0, 200).filter((b) => b === 0).length > 20
  const text = buffer.toString(utf16 ? 'utf16le' : 'utf8')
  const matches = [...text.matchAll(/(\d{1,3})(?:[.,]\d+)?\s?%/g)]
  const last = matches.at(-1)
  return last ? Math.min(100, Number(last[1])) : null
}

async function readPhase(file) {
  try {
    const lines = (await readFile(file, 'utf8'))
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/)
    return JSON.parse(lines.at(-1)).phase ?? null
  } catch {
    return null
  }
}

async function repairSystemFiles(update) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'windiag-'))
  const timer = setInterval(async () => {
    const phase = await readPhase(path.join(dir, 'progress.jsonl'))
    if (!phase) return
    update({ phase, percent: await readPercent(path.join(dir, `${phase}.txt`)) })
  }, 1500)
  try {
    const result = await runElevatedPowerShell(systemFilesScript(dir), 3 * 3600e3, {
      isolated: true
    })
    if (!result.ok) return result
    const { dism, sfc, repaired, unrepaired } = result.result ?? {}
    const dismCode = Number(dism) >>> 0
    const notes = []
    if (dismCode !== 0)
      notes.push(DISM_ERRORS[dismCode] ?? `DISM couldn’t finish (code 0x${dismCode.toString(16)}).`)
    if (unrepaired > 0)
      return {
        ok: false,
        error: [
          'System File Checker found damaged files it couldn’t repair.',
          ...notes,
          'Restart Windows and run the repair once more; if it still fails, Windows may need a repair install.'
        ].join(' ')
      }
    if (repaired > 0)
      return {
        ok: true,
        title: 'Damaged system files were repaired.',
        text: 'Restart Windows so the repaired files are used.',
        restart: true
      }
    if (Number(sfc) !== 0)
      return {
        ok: false,
        error: [
          'System File Checker couldn’t finish.',
          ...notes,
          'Restart Windows and try again.'
        ].join(' ')
      }
    return {
      ok: true,
      title: 'Windows’ system files are fine.',
      text: notes.length ? notes.join(' ') : 'No damaged files were found.'
    }
  } finally {
    clearInterval(timer)
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/* --- Network --------------------------------------------------------------- */

async function flushDns() {
  const result = await runActionScript(
    "ipconfig /flushdns | Out-Null\nif ($LASTEXITCODE -ne 0) { throw 'ipconfig failed' }\n'done'",
    { label: 'Clearing the DNS cache' }
  )
  return result.ok
    ? { ok: true, title: 'The DNS cache is clear.', text: 'Try the website again.' }
    : result
}

// Resets Winsock and TCP/IP to how Windows installs them. "netsh int ip
// reset" often reports one key it can't reset; that's harmless, so only
// Winsock's result counts.
const NETWORK_RESET = String.raw`
ipconfig /flushdns | Out-Null
netsh winsock reset | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Winsock could not be reset' }
netsh int ip reset | Out-Null
netsh int ipv6 reset | Out-Null
'done'
`

async function resetNetwork() {
  const result = await runActionScript(NETWORK_RESET, {
    admin: true,
    label: 'Resetting the network'
  })
  return result.ok
    ? {
        ok: true,
        title: 'The network settings are reset.',
        text: 'Restart Windows to finish. Wi-Fi networks and passwords are kept; a VPN app may need to be reinstalled.',
        restart: true
      }
    : result
}

/* --- Windows Update -------------------------------------------------------- */

// Stops Windows Update, renames its download folder and catalogue so it
// builds them again, and starts it again
const WINDOWS_UPDATE_RESET = String.raw`
$services = 'wuauserv', 'bits', 'cryptsvc'
foreach ($s in $services) { Stop-Service -Name $s -Force -ErrorAction SilentlyContinue }
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Service -Name $services | Where-Object Status -ne 'Stopped') -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }

$folders = @("$env:SystemRoot\SoftwareDistribution", "$env:SystemRoot\System32\catroot2")
try {
    foreach ($folder in $folders) {
        if (Test-Path -LiteralPath "$folder.old") { Remove-Item -LiteralPath "$folder.old" -Recurse -Force -ErrorAction SilentlyContinue }
        if (Test-Path -LiteralPath $folder) { Rename-Item -LiteralPath $folder -NewName ((Split-Path $folder -Leaf) + '.old') -Force }
    }
} catch {
    throw "Windows Update was busy and couldn't be reset. Restart Windows and try again."
} finally {
    foreach ($s in $services) { Start-Service -Name $s -ErrorAction SilentlyContinue }
}
'done'
`

async function resetWindowsUpdate() {
  const result = await runActionScript(WINDOWS_UPDATE_RESET, {
    admin: true,
    label: 'Resetting Windows Update',
    timeoutMs: 300e3
  })
  return result.ok
    ? {
        ok: true,
        title: 'Windows Update is reset.',
        text: 'Check for updates again. The update history in Settings starts empty; installed updates stay.'
      }
    : result
}

/* --- Restore points -------------------------------------------------------- */

async function createRestorePoint({ enable = false } = {}) {
  const result = await runActionScript(
    `${restorePointScript('WinDiag: restore point', { enable })}\n'done'`,
    { admin: true, label: 'Creating a restore point', isolated: true, timeoutMs: 600e3 }
  )
  if (result.ok)
    return {
      ok: true,
      title: 'A restore point was created.',
      text: 'If something goes wrong later, you can take Windows back to how it is now. Your files aren’t affected.'
    }
  if (/^RESTORE_POINT/.test(result.error ?? '') && !enable)
    return {
      ok: false,
      protectionOff: true,
      error:
        'Windows couldn’t create a restore point. System Protection is probably off for this drive.'
    }
  return { ...result, error: result.error?.replace(/^RESTORE_POINT: ?/, '') }
}

/* --- Quick fixes ----------------------------------------------------------- */

function launch(exe, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(systemRoot(), 'System32', exe), args, {
      detached: true,
      stdio: 'ignore'
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

async function explorer() {
  const result = await restartExplorer()
  return result.ok
    ? {
        ok: true,
        title: 'File Explorer restarted.',
        text: 'The taskbar and Start should respond again.'
      }
    : result
}

async function storeReset() {
  await launch('wsreset.exe')
  return {
    ok: true,
    title: 'The Microsoft Store cache is being cleared.',
    text: 'A blank window appears for a moment, then the Store opens.'
  }
}

/* --- Jobs ------------------------------------------------------------------ */

const ACTIONS = {
  systemFiles: repairSystemFiles,
  flushDns,
  network: resetNetwork,
  windowsUpdate: resetWindowsUpdate,
  restorePoint: () => createRestorePoint(),
  restorePointEnable: () => createRestorePoint({ enable: true }),
  explorer,
  store: storeReset
}

let job = null
const listeners = new Set()

function publish() {
  for (const sender of listeners) {
    if (sender.isDestroyed()) listeners.delete(sender)
    else sender.send('repair:progress', getRepairJob())
  }
}

/** The running or last repair, for a page that opens while it runs. */
export function getRepairJob() {
  return job && JSON.parse(JSON.stringify(job))
}

export async function runRepair(id, sender) {
  requireWindows()
  const action = ACTIONS[id]
  if (!action) throw new Error(`Unknown repair: ${id}`)
  if (job && !job.done) throw new Error('Another repair is running')
  listeners.add(sender)
  job = { id, done: false, phase: null, percent: null }
  publish()
  let result
  try {
    result = await action((progress) => {
      Object.assign(job, progress)
      publish()
    })
  } catch (error) {
    result = { ok: false, error: error?.message ?? String(error) }
  }
  if (!result.ok && !result.cancelled) logError('repair', `Repair "${id}" failed`, result.error)
  job = { ...job, done: true, result }
  publish()
  return getRepairJob()
}

/** Opens System Restore, which asks for permission itself. */
export async function openSystemRestore() {
  requireWindows()
  // Through the shell, so Windows shows its permission prompt
  const error = await shell.openPath(path.join(systemRoot(), 'System32', 'rstrui.exe'))
  if (error) throw new Error(error)
  return true
}
