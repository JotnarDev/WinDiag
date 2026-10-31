// Windows Update in three modes, after the ones in Chris Titus Tech's WinUtil
// (MIT licence): Windows' own defaults, security updates only, or off.
//
// - default:  every policy below removed, services and scheduled tasks back
//             to how Windows ships them.
// - security: quality (security) updates still install, 4 days late; feature
//             updates wait a year; Windows Update stops offering drivers, so
//             it never replaces a driver the technician installed. Updates
//             download and wait for the user to install them.
// - disabled: nothing is downloaded. Disabling the wuauserv service alone
//             doesn't last (the Update Medic service sets it back to Manual),
//             so machine policies do the real work: automatic updates off and
//             Windows Update pointed at a local server that doesn't exist
//             (honoured on Home editions too).
import { runPowerShell } from './powershell'
import { isRunningElevated, notElevatedResult } from './system-tools'

export const UPDATE_MODES = ['default', 'security', 'disabled']

// WinDiag's server for the disabled mode; also what earlier versions wrote
const BLOCKED_UPDATE_SERVER = 'http://127.0.0.1'

const POLICY_KEY = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate'

// Every value any mode writes, so going back to default removes all of them.
// WUServer/WUStatusServer/UseWUServer are only removed when they hold
// WinDiag's blocking server: anything else is a company's WSUS server.
const RESET_SCRIPT = `
$wu = '${POLICY_KEY}'
$au = "$wu\\AU"
$values = @(
    @($au, @('NoAutoUpdate', 'AUOptions', 'NoAutoRebootWithLoggedOnUsers', 'AUPowerManagement')),
    @($wu, @('ExcludeWUDriversInQualityUpdate', 'DeferFeatureUpdates', 'DeferFeatureUpdatesPeriodInDays',
             'DeferQualityUpdates', 'DeferQualityUpdatesPeriodInDays', 'DoNotConnectToWindowsUpdateInternetLocations')),
    @('HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings', @('BranchReadinessLevel', 'DeferFeatureUpdatesPeriodInDays', 'DeferQualityUpdatesPeriodInDays')),
    @('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Device Metadata', @('PreventDeviceMetadataFromNetwork')),
    @('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DriverSearching', @('DontPromptForWindowsUpdate', 'DontSearchWindowsUpdate', 'DriverUpdateWizardWuSearchEnabled')),
    @('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization\\Config', @('DODownloadMode'))
)
foreach ($entry in $values) {
    foreach ($name in $entry[1]) { Remove-ItemProperty -Path $entry[0] -Name $name -ErrorAction SilentlyContinue }
}
$server = (Get-ItemProperty -Path $wu -Name WUServer -ErrorAction SilentlyContinue).WUServer
if ($server -eq '${BLOCKED_UPDATE_SERVER}') {
    Remove-ItemProperty -Path $wu -Name WUServer, WUStatusServer -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path $au -Name UseWUServer -ErrorAction SilentlyContinue
}
Set-Service -Name BITS -StartupType Manual -ErrorAction SilentlyContinue
Set-Service -Name wuauserv -StartupType Manual -ErrorAction SilentlyContinue
Set-Service -Name UsoSvc -StartupType Automatic -ErrorAction SilentlyContinue
Start-Service -Name UsoSvc -ErrorAction SilentlyContinue
`

const TASK_PATHS = `@(
    '\\Microsoft\\Windows\\InstallService\\', '\\Microsoft\\Windows\\UpdateOrchestrator\\',
    '\\Microsoft\\Windows\\UpdateAssistant\\', '\\Microsoft\\Windows\\WaaSMedic\\',
    '\\Microsoft\\Windows\\WindowsUpdate\\', '\\Microsoft\\WindowsUpdate\\'
)`

// Some of these tasks belong to SYSTEM and refuse the change; that's fine
const setTasks = (enable) => `
foreach ($path in ${TASK_PATHS}) {
    Get-ScheduledTask -TaskPath $path -ErrorAction SilentlyContinue |
        ${enable ? 'Enable-ScheduledTask' : 'Disable-ScheduledTask'} -ErrorAction SilentlyContinue | Out-Null
}
`

const setValue = (path, name, value, type = 'DWord') => `
if (-not (Test-Path '${path}')) { New-Item -Path '${path}' -Force | Out-Null }
Set-ItemProperty -Path '${path}' -Name '${name}' -Type ${type} -Value ${typeof value === 'string' ? `'${value}'` : value}
`

const SECURITY_SCRIPT = [
  setValue(
    'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Device Metadata',
    'PreventDeviceMetadataFromNetwork',
    1
  ),
  setValue(
    'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DriverSearching',
    'DontPromptForWindowsUpdate',
    1
  ),
  setValue(
    'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DriverSearching',
    'DontSearchWindowsUpdate',
    1
  ),
  setValue(
    'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DriverSearching',
    'DriverUpdateWizardWuSearchEnabled',
    0
  ),
  setValue(POLICY_KEY, 'ExcludeWUDriversInQualityUpdate', 1),
  setValue(POLICY_KEY, 'DeferFeatureUpdates', 1),
  setValue(POLICY_KEY, 'DeferFeatureUpdatesPeriodInDays', 365),
  setValue(POLICY_KEY, 'DeferQualityUpdates', 1),
  setValue(POLICY_KEY, 'DeferQualityUpdatesPeriodInDays', 4),
  // 3 = download automatically, let the user choose when to install
  setValue(`${POLICY_KEY}\\AU`, 'AUOptions', 3),
  setValue(`${POLICY_KEY}\\AU`, 'AUPowerManagement', 0)
].join('')

const DISABLED_SCRIPT = [
  setValue(`${POLICY_KEY}\\AU`, 'NoAutoUpdate', 1),
  setValue(`${POLICY_KEY}\\AU`, 'AUOptions', 1),
  setValue(`${POLICY_KEY}\\AU`, 'UseWUServer', 1),
  setValue(POLICY_KEY, 'WUServer', BLOCKED_UPDATE_SERVER, 'String'),
  setValue(POLICY_KEY, 'WUStatusServer', BLOCKED_UPDATE_SERVER, 'String'),
  setValue(POLICY_KEY, 'DoNotConnectToWindowsUpdateInternetLocations', 1),
  setValue(
    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization\\Config',
    'DODownloadMode',
    0
  ),
  `
foreach ($name in @('UsoSvc', 'wuauserv', 'BITS')) {
    Stop-Service -Name $name -Force -ErrorAction SilentlyContinue
    Set-Service -Name $name -StartupType Disabled -ErrorAction SilentlyContinue
}
`
].join('')

const MODE_SCRIPTS = {
  default: RESET_SCRIPT + setTasks(true),
  security: RESET_SCRIPT + setTasks(true) + SECURITY_SCRIPT,
  disabled: RESET_SCRIPT + DISABLED_SCRIPT + setTasks(false)
}

const MODE_NAMES = {
  default: 'Windows default',
  security: 'Security updates only',
  disabled: 'Off'
}

// Status and StartType are enums, so their names are always English
const STATE_SCRIPT = `
try {
    $service = Get-Service -Name wuauserv -ErrorAction Stop
    $wu = Get-ItemProperty -Path '${POLICY_KEY}' -ErrorAction SilentlyContinue
    $au = Get-ItemProperty -Path '${POLICY_KEY}\\AU' -ErrorAction SilentlyContinue
    [PSCustomObject]@{
        running        = $service.Status -eq 'Running'
        startType      = $service.StartType.ToString()
        noAutoUpdate   = [bool]($au -and $au.NoAutoUpdate -eq 1)
        blockedServer  = [bool]($wu -and $wu.WUServer -eq '${BLOCKED_UPDATE_SERVER}')
        otherServer    = [bool]($wu -and $wu.WUServer -and $wu.WUServer -ne '${BLOCKED_UPDATE_SERVER}')
        noDrivers      = [bool]($wu -and $wu.ExcludeWUDriversInQualityUpdate -eq 1)
        deferFeatures  = [bool]($wu -and $wu.DeferFeatureUpdates -eq 1)
    } | ConvertTo-Json -Compress
} catch { '' }`

/**
 * The mode in force, read from the machine (a policy set by hand or by
 * another tool shows up too), plus the wuauserv service and whether a
 * company update server (WSUS) is configured.
 */
export async function getWindowsUpdateState() {
  try {
    const s = JSON.parse(await runPowerShell(STATE_SCRIPT))
    const mode =
      s.noAutoUpdate || s.blockedServer || s.startType === 'Disabled'
        ? 'disabled'
        : s.noDrivers && s.deferFeatures
          ? 'security'
          : 'default'
    return {
      mode,
      running: s.running,
      startType: s.startType,
      managed: s.otherServer
    }
  } catch {
    return { mode: 'unknown', running: null, startType: null, managed: false }
  }
}

export async function setWindowsUpdateMode(mode) {
  if (!UPDATE_MODES.includes(mode))
    return { success: false, message: `Unknown Windows Update mode: ${mode}` }
  if (!(await isRunningElevated())) return notElevatedResult('change Windows Update')
  try {
    await runPowerShell(MODE_SCRIPTS[mode], 120e3)
  } catch (err) {
    return {
      success: false,
      message: `Couldn't change Windows Update: ${err instanceof Error ? err.message : err}`
    }
  }
  const after = await getWindowsUpdateState()
  if (after.mode !== mode) {
    return {
      success: false,
      message:
        mode === 'disabled' && after.running
          ? 'The policies were written, but the Windows Update service is still running (it may be installing something). Try again in a minute.'
          : `The settings were written, but Windows still reports “${MODE_NAMES[after.mode] ?? after.mode}”. A group policy may be overriding them.`
    }
  }
  return { success: true, message: `Windows Update: ${MODE_NAMES[mode]}.` }
}

// Lets WinDiag itself reach Windows Update for drivers while the security or
// off mode is in force: the driver exclusion and WinDiag's blocking server are
// lifted and the services started. Automatic updates stay off (NoAutoUpdate
// doesn't stop a search WinDiag asks for), so Windows doesn't start
// installing things on its own in the meantime.
const OPEN_FOR_DRIVERS_SCRIPT = `
$wu = '${POLICY_KEY}'
Remove-ItemProperty -Path $wu -Name ExcludeWUDriversInQualityUpdate, DoNotConnectToWindowsUpdateInternetLocations -ErrorAction SilentlyContinue
if ((Get-ItemProperty -Path $wu -Name WUServer -ErrorAction SilentlyContinue).WUServer -eq '${BLOCKED_UPDATE_SERVER}') {
    Remove-ItemProperty -Path $wu -Name WUServer, WUStatusServer -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "$wu\\AU" -Name UseWUServer -ErrorAction SilentlyContinue
}
foreach ($name in @('BITS', 'wuauserv')) {
    Set-Service -Name $name -StartupType Manual -ErrorAction SilentlyContinue
    Start-Service -Name $name -ErrorAction SilentlyContinue
}
`

let accessQueue = Promise.resolve()

/**
 * Runs `task` with Windows Update reachable for driver searches and installs,
 * then puts the chosen mode back. One at a time: a second call waits.
 */
export function withWindowsUpdateAccess(task) {
  const run = async () => {
    const { mode } = await getWindowsUpdateState()
    const restricted = mode === 'security' || mode === 'disabled'
    if (restricted) {
      if (!(await isRunningElevated())) {
        throw new Error(
          'Windows Update is limited on this computer (Tools → Windows Update). Run WinDiag as administrator so it can search for drivers anyway.'
        )
      }
      await runPowerShell(OPEN_FOR_DRIVERS_SCRIPT, 60e3)
    }
    try {
      return await task()
    } finally {
      if (restricted) await runPowerShell(MODE_SCRIPTS[mode], 120e3).catch(() => '')
    }
  }
  const result = accessQueue.then(run, run)
  accessQueue = result.catch(() => undefined)
  return result
}
