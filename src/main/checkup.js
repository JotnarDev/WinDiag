import os from 'os'
import { shell } from 'electron'
import si from 'systeminformation'
import { runPowerShell, runPowerShellIsolated } from './powershell'
import { getWindowsActivation } from './system-info'
import { getMainDiskHealth } from './disk-health'
import { getStartupApps } from './speed'
import { logError } from './log'

/*
 * The home edition's checkup: quick, read-only checks that need no admin
 * rights. Each returns plain facts; the page decides how to word them. A check
 * that can't read its facts throws, and the page shows "Couldn't check".
 */

const isWindows = process.platform === 'win32'

function requireWindows() {
  if (!isWindows) throw new Error('Only available on Windows')
}

const bytesToGB = (bytes) => Math.round((bytes / 1024 ** 3) * 10) / 10

async function checkBattery() {
  const battery = await si.battery()
  if (!battery.hasBattery) return { hasBattery: false }
  const max = battery.maxCapacity > 0 ? battery.maxCapacity : null
  const designed = battery.designedCapacity > 0 ? battery.designedCapacity : null
  return {
    hasBattery: true,
    healthPercent: max && designed ? Math.min(100, Math.round((max / designed) * 100)) : null,
    cycleCount: battery.cycleCount > 0 ? battery.cycleCount : null
  }
}

async function checkDrive() {
  const health = await getMainDiskHealth()
  if (!health || health.healthStatus === 'unknown') throw new Error('No health data')
  return { healthPercent: health.healthPercent, healthStatus: health.healthStatus }
}

async function checkSpace() {
  const volumes = await si.fsSize()
  const mount = isWindows ? (process.env.SystemDrive ?? 'C:').toUpperCase() : '/'
  const volume = volumes.find((v) => (v.mount ?? '').toUpperCase() === mount)
  if (!volume || !(volume.size > 0)) throw new Error('System drive not found')
  return {
    drive: mount,
    freeGB: bytesToGB(volume.available),
    totalGB: bytesToGB(volume.size),
    freePercent: Math.round((volume.available / volume.size) * 100)
  }
}

// Asks Windows Update itself, like Settings does: software updates only
// (drivers are on the Updates page), not hidden ones.
const UPDATES_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
try {
    $session = New-Object -ComObject Microsoft.Update.Session
    $session.ClientApplicationID = 'WinDiag'
    $searcher = $session.CreateUpdateSearcher()
    $result = $searcher.Search("IsInstalled=0 and IsHidden=0 and Type='Software'")
    $titles = @()
    foreach ($update in $result.Updates) { $titles += [string]$update.Title }
    ConvertTo-Json -InputObject @{ ok = $true; titles = @($titles) } -Compress
} catch {
    ConvertTo-Json -InputObject @{ ok = $false; error = $_.Exception.Message } -Compress
}
`

async function checkUpdates() {
  requireWindows()
  // An online search can take a minute or more on a slow connection
  const output = await runPowerShellIsolated(UPDATES_SCRIPT, 180e3)
  const result = JSON.parse(output)
  if (!result.ok) throw new Error(result.error || 'Windows Update did not answer')
  const titles = Array.isArray(result.titles) ? result.titles : []
  return { count: titles.length, titles }
}

async function checkStartup() {
  const apps = await getStartupApps()
  const enabled = apps.filter((app) => app.enabled).map((app) => app.name)
  return { enabledCount: enabled.length, totalCount: apps.length, enabled }
}

// Antivirus as Windows Security Center reports it (productState: the middle
// byte 0x10/0x11 = on, the last byte 0x00 = definitions up to date), and the
// three firewall profiles.
const SECURITY_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$antivirus = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object {
    $hex = '{0:x6}' -f [int]$_.productState
    [PSCustomObject]@{
        Name = [string]$_.displayName
        Enabled = $hex.Substring(2, 2) -in @('10', '11')
        UpToDate = $hex.Substring(4, 2) -eq '00'
    }
})
$firewall = @(Get-NetFirewallProfile | ForEach-Object {
    [PSCustomObject]@{ Name = [string]$_.Name; Enabled = ("$($_.Enabled)" -eq 'True') }
})
ConvertTo-Json -InputObject @{ antivirus = $antivirus; firewall = $firewall } -Compress -Depth 4
`

async function checkSecurity() {
  requireWindows()
  const result = JSON.parse(await runPowerShell(SECURITY_SCRIPT, 20e3))
  const antivirus = [result.antivirus ?? []].flat()
  const firewall = [result.firewall ?? []].flat()
  if (antivirus.length === 0 && firewall.length === 0) throw new Error('No security data')
  const active = antivirus.filter((av) => av.Enabled)
  return {
    antivirusName: active[0]?.Name ?? antivirus[0]?.Name ?? null,
    antivirusOn: active.length > 0,
    definitionsCurrent: active.some((av) => av.UpToDate),
    firewallOff: firewall.filter((p) => !p.Enabled).map((p) => p.Name)
  }
}

async function checkActivation() {
  requireWindows()
  const activated = await getWindowsActivation()
  if (activated === null) throw new Error('Activation could not be read')
  return { activated }
}

async function checkUptime() {
  return { days: Math.floor(os.uptime() / 86400) }
}

const CHECKS = {
  battery: checkBattery,
  drive: checkDrive,
  space: checkSpace,
  updates: checkUpdates,
  startup: checkStartup,
  security: checkSecurity,
  activation: checkActivation,
  uptime: checkUptime
}

/** Runs one check by id: { ok: true, data } or { ok: false, error }. */
export async function runCheck(id) {
  const check = CHECKS[id]
  if (!check) throw new Error(`Unknown check: ${id}`)
  try {
    return { ok: true, data: await check() }
  } catch (error) {
    const message = error?.message ?? String(error)
    if (message !== 'Only available on Windows') logError(`checkup:${id}`, message, error)
    return { ok: false, error: message }
  }
}

// Pages of Windows the checkup's buttons can open; nothing else is allowed.
const WINDOWS_PAGES = {
  windowsUpdate: 'ms-settings:windowsupdate',
  storage: 'ms-settings:storagesense',
  startupApps: 'ms-settings:startupapps',
  activation: 'ms-settings:activation',
  windowsSecurity: 'windowsdefender:',
  firewall: 'windowsdefender://network',
  power: 'ms-settings:powersleep',
  // App Installer, which brings winget
  appInstaller: 'ms-windows-store://pdp/?productid=9NBLGGH4NNS1'
}

export async function openWindowsPage(id) {
  const uri = WINDOWS_PAGES[id]
  if (!uri) throw new Error(`Unknown Windows page: ${id}`)
  requireWindows()
  await shell.openExternal(uri)
  return true
}
