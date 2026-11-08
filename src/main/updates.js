import { execFile } from 'child_process'
import { mkdtemp, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { shell } from 'electron'
import { runPowerShellIsolated } from './powershell'
import { runElevatedPowerShell } from './elevated'
import { buildBiosInfo, buildDeviceInfo } from './system-info'
import { logError } from './log'

/*
 * The home edition's Updates page: Windows Update (software and drivers),
 * asked through its own COM API like Settings does, and the PC maker's page
 * for drivers and BIOS. Installing needs admin rights: one UAC prompt, then
 * the updates download and install one by one while the page follows along.
 */

const isWindows = process.platform === 'win32'

function requireWindows() {
  if (!isWindows) throw new Error('Only available on Windows')
}

const psString = (value) => `'${String(value).replace(/'/g, "''")}'`
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* --- Search ---------------------------------------------------------------- */

const SEARCH_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
try {
    $session = New-Object -ComObject Microsoft.Update.Session
    $session.ClientApplicationID = 'WinDiag'
    $searcher = $session.CreateUpdateSearcher()
    $result = $searcher.Search("IsInstalled=0 and IsHidden=0")
    $updates = @()
    foreach ($u in $result.Updates) {
        $driver = $u.Type -eq 2
        $updates += @{
            id = [string]$u.Identity.UpdateID
            title = [string]$u.Title
            driver = $driver
            optional = [bool]$u.BrowseOnly
            kb = @($u.KBArticleIDs | ForEach-Object { [string]$_ })
            size = [double]$u.MaxDownloadSize
            downloaded = [bool]$u.IsDownloaded
            restart = [int]$u.InstallationBehavior.RebootBehavior
            driverClass = $(if ($driver) { [string]$u.DriverClass } else { $null })
            driverMaker = $(if ($driver) { [string]$u.DriverManufacturer } else { $null })
            driverDate = $(if ($driver -and $u.DriverVerDate) { $u.DriverVerDate.ToString('yyyy-MM-dd') } else { $null })
        }
    }
    # When updates last installed, from Windows Update's history
    $lastInstalled = $null
    $count = $searcher.GetTotalHistoryCount()
    if ($count -gt 0) {
        foreach ($h in $searcher.QueryHistory(0, [Math]::Min($count, 50))) {
            if ($h.Operation -eq 1 -and $h.ResultCode -eq 2) { $lastInstalled = $h.Date.ToUniversalTime().ToString('o'); break }
        }
    }
    $restartPending = (New-Object -ComObject Microsoft.Update.SystemInfo).RebootRequired
    ConvertTo-Json -InputObject @{ ok = $true; updates = @($updates); lastInstalled = $lastInstalled; restartPending = [bool]$restartPending } -Compress -Depth 4
} catch {
    ConvertTo-Json -InputObject @{ ok = $false; error = $_.Exception.Message; code = ('0x{0:X8}' -f $_.Exception.HResult) } -Compress
}
`

// Windows Update errors people actually run into
const WU_ERRORS = {
  '0x8024402C': 'Windows Update can’t reach the internet. Check your connection.',
  '0x80072EE2': 'Windows Update can’t reach the internet. Check your connection.',
  '0x80072EFD': 'Windows Update can’t reach the internet. Check your connection.',
  '0x8024001E': 'Windows Update was interrupted. Try again.',
  '0x80240016': 'Windows is already installing something. Try again when it ends.',
  '0x80070070': 'There isn’t enough free space on the drive.',
  '0x80070643': 'An update failed to install. Windows will offer it again.',
  '0x800F0922': 'An update failed to install. Restart Windows and try again.',
  '0x8024A105': 'Windows Update needs a restart first.',
  '0x80240438': 'Windows Update can’t reach Microsoft’s servers right now.'
}

const explain = (code, fallback) =>
  WU_ERRORS[code] ?? (fallback ? `${fallback} (${code})` : `Windows Update error ${code}`)

// The last search, id (lower-case) → title: only those can be installed
let offered = new Map()

/** What Windows Update offers, and whether a restart is pending. */
export async function getWindowsUpdates() {
  requireWindows()
  // An online search can take a minute or more on a slow connection
  const result = JSON.parse(await runPowerShellIsolated(SEARCH_SCRIPT, 300e3))
  if (!result.ok) {
    logError('updates', 'Searching for updates failed', `${result.code} ${result.error}`)
    throw new Error(explain(result.code, result.error))
  }
  const updates = (result.updates ?? []).map((u) => ({
    ...u,
    kb: u.kb ?? [],
    // Firmware covers the BIOS/UEFI and other chips' own software
    firmware: Boolean(u.driver && /firmware/i.test(u.driverClass ?? ''))
  }))
  offered = new Map(updates.map((u) => [u.id.toLowerCase(), u.title]))
  return {
    updates,
    lastInstalled: result.lastInstalled ?? null,
    restartPending: Boolean(result.restartPending)
  }
}

/* --- Install --------------------------------------------------------------- */

// Writes a line of JSON per step to the progress file, which WinDiag reads
// while the elevated PowerShell runs
const installScript = (ids, progressFile, restorePoint) => String.raw`
$progress = ${psString(progressFile)}
function Step($data) { Add-Content -LiteralPath $progress -Value (ConvertTo-Json -InputObject $data -Compress) -Encoding UTF8 }
$ids = @(${ids.map(psString).join(', ')})

if (${restorePoint ? '$true' : '$false'}) {
    Step @{ phase = 'restorePoint' }
    $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore'
    # Windows makes at most one restore point a day unless told otherwise
    $old = (Get-ItemProperty -LiteralPath $key -Name SystemRestorePointCreationFrequency -ErrorAction SilentlyContinue).SystemRestorePointCreationFrequency
    New-ItemProperty -LiteralPath $key -Name SystemRestorePointCreationFrequency -PropertyType DWord -Value 0 -Force | Out-Null
    try {
        Checkpoint-Computer -Description 'WinDiag: before installing updates' -RestorePointType MODIFY_SETTINGS
        # It may only warn when it can't make one, so check that one is there
        $latest = Get-ComputerRestorePoint | Select-Object -Last 1
        if (-not $latest -or [Management.ManagementDateTimeConverter]::ToDateTime($latest.CreationTime) -lt (Get-Date).AddMinutes(-15)) {
            throw 'No restore point was created'
        }
    } catch {
        throw "RESTORE_POINT: $($_.Exception.Message)"
    } finally {
        if ($null -eq $old) { Remove-ItemProperty -LiteralPath $key -Name SystemRestorePointCreationFrequency -ErrorAction SilentlyContinue }
        else { New-ItemProperty -LiteralPath $key -Name SystemRestorePointCreationFrequency -PropertyType DWord -Value $old -Force | Out-Null }
    }
}

Step @{ phase = 'searching' }
$session = New-Object -ComObject Microsoft.Update.Session
$session.ClientApplicationID = 'WinDiag'
$found = $session.CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0").Updates
$chosen = @()
foreach ($u in $found) { if ($ids -contains [string]$u.Identity.UpdateID) { $chosen += $u } }

$results = @()
$restart = $false
foreach ($u in $chosen) {
    $id = [string]$u.Identity.UpdateID
    try {
        if (-not $u.EulaAccepted) { $u.AcceptEula() }
        $one = New-Object -ComObject Microsoft.Update.UpdateColl
        [void]$one.Add($u)
        if (-not $u.IsDownloaded) {
            Step @{ id = $id; state = 'downloading' }
            $downloader = $session.CreateUpdateDownloader()
            $downloader.Updates = $one
            $d = $downloader.Download()
            if ($d.ResultCode -ne 2 -and $d.ResultCode -ne 3) {
                throw ('0x{0:X8}' -f $d.HResult)
            }
        }
        Step @{ id = $id; state = 'installing' }
        $installer = $session.CreateUpdateInstaller()
        $installer.Updates = $one
        $r = $installer.Install()
        $code = $r.GetUpdateResult(0).ResultCode
        if ($code -ne 2 -and $code -ne 3) { throw ('0x{0:X8}' -f $r.GetUpdateResult(0).HResult) }
        if ($r.RebootRequired) { $restart = $true }
        Step @{ id = $id; state = 'done'; restart = [bool]$r.RebootRequired }
        $results += @{ id = $id; ok = $true }
    } catch {
        $message = $_.Exception.Message
        $code = $(if ($message -match '^0x[0-9A-F]{8}$') { $message } else { '0x{0:X8}' -f $_.Exception.HResult })
        Step @{ id = $id; state = 'failed'; code = $code; error = $message }
        $results += @{ id = $id; ok = $false; code = $code }
    }
}
$chosenIds = @($chosen | ForEach-Object { [string]$_.Identity.UpdateID })
$missing = @($ids | Where-Object { $chosenIds -notcontains $_ })
@{ results = @($results); restart = $restart; missing = $missing }
`

// One job at a time: { items: [{ id, title, state, error }], phase, restart, done }
let job = null
const listeners = new Set()

function publish() {
  const snapshot = getUpdatesJob()
  for (const sender of listeners) {
    if (sender.isDestroyed()) listeners.delete(sender)
    else sender.send('updates:progress', snapshot)
  }
}

export function getUpdatesJob() {
  return job && JSON.parse(JSON.stringify(job))
}

/** Reads the steps the elevated script has written so far. */
async function readProgress(file) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch {
    return
  }
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.trim()) continue
    let step
    try {
      step = JSON.parse(line)
    } catch {
      continue
    }
    if (step.phase) job.phase = step.phase
    const item = step.id && job.items.find((i) => i.id.toLowerCase() === step.id.toLowerCase())
    if (item) {
      job.phase = 'updating'
      item.state = step.state
      if (step.state === 'failed')
        item.error = explain(step.code, step.error !== step.code ? step.error : null)
    }
  }
}

/**
 * Installs the chosen updates: [{ id, title }] from the last search. With
 * restorePoint, a restore point is made first; if that fails, nothing is
 * installed.
 */
export async function installWindowsUpdates(ids, restorePoint, sender) {
  requireWindows()
  if (job && !job.done) throw new Error('Updates are already being installed')
  const chosen = ids.filter((id) => GUID.test(id) && offered.has(id.toLowerCase()))
  if (chosen.length === 0 || chosen.length !== ids.length)
    throw new Error('Search for updates again, then choose them')

  listeners.add(sender)
  job = {
    phase: 'waiting',
    items: chosen.map((id) => ({ id, title: offered.get(id.toLowerCase()), state: 'waiting' })),
    restart: false,
    done: false
  }
  publish()

  const folder = await mkdtemp(path.join(os.tmpdir(), 'windiag-'))
  const progressFile = path.join(folder, 'progress.jsonl')
  const timer = setInterval(async () => {
    await readProgress(progressFile)
    publish()
  }, 1000)
  try {
    const result = await runElevatedPowerShell(
      installScript(chosen, progressFile, restorePoint),
      4 * 3600e3,
      { isolated: true }
    )
    clearInterval(timer)
    await readProgress(progressFile)
    if (result.cancelled) {
      job.cancelled = true
      for (const item of job.items) if (item.state === 'waiting') item.state = 'skipped'
    } else if (!result.ok) {
      const restore = /^RESTORE_POINT: ?/.test(result.error ?? '')
      job.error = restore
        ? 'Windows couldn’t make a restore point, so nothing was installed. System Protection may be off for this drive.'
        : (result.error ?? 'Windows Update stopped.')
      job.restorePointFailed = restore
      logError('updates', 'Installing updates failed', result.error)
      for (const item of job.items)
        if (item.state !== 'done') item.state = item.state === 'failed' ? 'failed' : 'skipped'
    } else {
      job.restart = Boolean(result.result?.restart)
      for (const id of result.result?.missing ?? []) {
        const item = job.items.find((i) => i.id.toLowerCase() === String(id).toLowerCase())
        if (item) {
          item.state = 'failed'
          item.error = 'Windows Update no longer offers it.'
        }
      }
      for (const item of job.items.filter((i) => i.state === 'failed'))
        logError('updates', `Update ${item.id} failed`, item.error)
    }
  } finally {
    clearInterval(timer)
    job.done = true
    publish()
    await rm(folder, { recursive: true, force: true }).catch(() => {})
  }
  return getUpdatesJob()
}

/** Restarts Windows in a few seconds, to finish installing. */
export function restartWindows() {
  requireWindows()
  return new Promise((resolve, reject) =>
    execFile('shutdown.exe', ['/r', '/t', '5'], { windowsHide: true }, (error) =>
      error ? reject(error) : resolve(true)
    )
  )
}

/* --- PC maker -------------------------------------------------------------- */

// Each maker's driver page and its own update app
const MAKERS = [
  {
    match: /^dell/i,
    name: 'Dell',
    app: 'Dell Command | Update or SupportAssist',
    url: (serial) =>
      serial && /^[A-Z0-9]{7}$/i.test(serial)
        ? `https://www.dell.com/support/home/product-support/servicetag/${serial}/drivers`
        : 'https://www.dell.com/support/home/'
  },
  {
    match: /^(hp|hewlett)/i,
    name: 'HP',
    app: 'HP Support Assistant',
    url: () => 'https://support.hp.com/drivers'
  },
  {
    match: /^lenovo/i,
    name: 'Lenovo',
    app: 'Lenovo Vantage',
    url: () => 'https://pcsupport.lenovo.com/'
  },
  {
    match: /^asus/i,
    name: 'ASUS',
    app: 'MyASUS',
    url: () => 'https://www.asus.com/support/download-center/'
  },
  {
    match: /^acer/i,
    name: 'Acer',
    app: 'Acer Care Center',
    url: () => 'https://www.acer.com/support/drivers-and-manuals'
  },
  {
    match: /^(msi|micro-star)/i,
    name: 'MSI',
    app: 'MSI Center',
    url: () => 'https://www.msi.com/support/download'
  },
  {
    match: /^microsoft/i,
    name: 'Microsoft Surface',
    app: null,
    url: () => 'https://support.microsoft.com/surface/download-drivers-and-firmware-for-surface'
  },
  {
    match: /^(gigabyte|giga-byte)/i,
    name: 'Gigabyte',
    app: 'Gigabyte Control Center',
    url: () => 'https://www.gigabyte.com/Support'
  },
  {
    match: /^samsung/i,
    name: 'Samsung',
    app: 'Samsung Update',
    url: () => 'https://www.samsung.com/support/'
  }
]

let makerCache = null

async function readMaker() {
  const [device, bios] = await Promise.all([buildDeviceInfo(), buildBiosInfo()])
  const maker = MAKERS.find((m) => m.match.test(device.manufacturer ?? ''))
  return { device, bios, maker }
}

/** The PC's maker and model, its BIOS, and where the maker offers drivers. */
export async function getMakerInfo() {
  makerCache ??= await readMaker()
  const { device, bios, maker } = makerCache
  return {
    manufacturer: maker?.name ?? device.manufacturer ?? null,
    model: device.model ?? null,
    biosVersion: bios.version ?? null,
    biosDate: bios.releaseDate ?? null,
    makerApp: maker?.app ?? null,
    hasSupportPage: Boolean(maker)
  }
}

export async function openMakerSupport() {
  makerCache ??= await readMaker()
  const { device, maker } = makerCache
  if (!maker) throw new Error('No support page known for this maker')
  await shell.openExternal(maker.url(device.serialNumber))
  return true
}
