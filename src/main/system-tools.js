import { app, shell } from 'electron'
import path from 'path'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { randomUUID } from 'crypto'
import { runPowerShell } from './powershell'

const execFileAsync = promisify(execFile)
function systemRoot() {
  return process.env.SystemRoot || process.env.windir || 'C:\\Windows'
}

async function openPath(exePath, successMessage) {
  try {
    const errorMessage = await shell.openPath(exePath)
    if (errorMessage) {
      return { success: false, message: errorMessage }
    }
    return { success: true, message: successMessage }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}

const SYSTEM_TOOL_PATHS = {
  // Sysprep's own GUI is what lets a technician choose the cleanup action,
  // the Generalize checkbox and the shutdown option — nothing runs until
  // they confirm inside that dialog. This app never passes /generalize or
  // /oobe directly.
  sysprep: ['System32', 'Sysprep', 'sysprep.exe'],
  tabletCalibration: ['System32', 'tabcal.exe'],
  dxdiag: ['System32', 'dxdiag.exe'],
  systemInformation: ['System32', 'msinfo32.exe'],
  deviceManager: ['System32', 'devmgmt.msc'],
  eventViewer: ['System32', 'eventvwr.msc'],
  resourceMonitor: ['System32', 'resmon.exe'],
  diskManagement: ['System32', 'diskmgmt.msc'],
  optimizeDrives: ['System32', 'dfrgui.exe'],
  diskCleanup: ['System32', 'cleanmgr.exe'],
  systemConfiguration: ['System32', 'msconfig.exe'],
  systemRestore: ['System32', 'rstrui.exe'],
  programsAndFeatures: ['System32', 'appwiz.cpl'],
  networkConnections: ['System32', 'ncpa.cpl'],
  // Only opens the tool's own "restart now / check next boot" dialog — it
  // does not schedule or force a memory test on its own.
  memoryDiagnostic: ['System32', 'MdSched.exe']
}

const SYSTEM_TOOL_LABELS = {
  sysprep: 'Sysprep',
  tabletCalibration: 'Tablet PC digitizer calibration',
  dxdiag: 'DirectX Diagnostic Tool',
  systemInformation: 'System Information',
  deviceManager: 'Device Manager',
  eventViewer: 'Event Viewer',
  resourceMonitor: 'Resource Monitor',
  diskManagement: 'Disk Management',
  optimizeDrives: 'Optimize Drives',
  diskCleanup: 'Disk Cleanup',
  systemConfiguration: 'System Configuration',
  systemRestore: 'System Restore',
  programsAndFeatures: 'Programs and Features',
  networkConnections: 'Network Connections',
  memoryDiagnostic: 'Windows Memory Diagnostic'
}

export async function launchSystemTool(toolId) {
  const segments = SYSTEM_TOOL_PATHS[toolId]
  if (!segments) {
    return { success: false, message: `Unknown tool: ${toolId}` }
  }
  return openPath(path.join(systemRoot(), ...segments), `${SYSTEM_TOOL_LABELS[toolId]} launched.`)
}

export async function launchProductKeyDialog() {
  try {
    const child = spawn(path.join(systemRoot(), 'System32', 'slui.exe'), ['3'], {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return { success: true, message: 'Product key dialog launched.' }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Windows translates error text ("Access is denied" / "Acceso denegado"), so
// nothing below inspects error messages. Admin-only operations check
// elevation up front, and other outcomes come from state queries or exit codes.
const NOT_ELEVATED_SUFFIX =
  'Close WinDiag and reopen it as Administrator (use "Run as administrator" at the bottom of the navigation pane, or right-click the app → "Run as administrator")'

export function notElevatedResult(action) {
  return {
    success: false,
    message: `Administrator permission is required to ${action}. ${NOT_ELEVATED_SUFFIX}.`
  }
}

const errorMessage = (err) => (err instanceof Error ? err.message : String(err))

// Disabling only the wuauserv service doesn't last on Windows 10/11: the
// Windows Update Medic service quietly sets it back to Manual. Machine
// policies aren't touched by it, so they do the real work: automatic updates
// off, and Windows Update pointed at a local server that doesn't exist (this
// one is honoured on Home editions too). Disabling the service is a bonus.
const WU_KEY = 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate'
const WU_AU_KEY = `${WU_KEY}\\AU`
const BLOCKED_UPDATE_SERVER = 'http://127.0.0.1'
const WU_POLICY_VALUES = [
  [WU_AU_KEY, 'NoAutoUpdate', 'REG_DWORD', '1'],
  [WU_AU_KEY, 'UseWUServer', 'REG_DWORD', '1'],
  [WU_KEY, 'WUServer', 'REG_SZ', BLOCKED_UPDATE_SERVER],
  [WU_KEY, 'WUStatusServer', 'REG_SZ', BLOCKED_UPDATE_SERVER],
  [WU_KEY, 'DoNotConnectToWindowsUpdateInternetLocations', 'REG_DWORD', '1']
]

// sc/reg print their errors on stdout, which is what's worth showing
const commandError = (err) =>
  (typeof err?.stdout === 'string' && err.stdout.trim()) || errorMessage(err)

const runCommand = (file, args) =>
  execFileAsync(file, args, { windowsHide: true, timeout: 15e3 }).then(
    () => null,
    (err) => commandError(err)
  )

// What the switch shows: the wuauserv service itself (running, startup type)
// plus whether WinDiag's blocking policy is in place. "off" means the service
// is stopped and disabled; Windows (the Update Medic service) can turn it
// back on by itself, and then the switch shows it on again.
export async function getWindowsUpdateState() {
  try {
    // Status and StartType are enums, so their names are always English
    const output = await runPowerShell(`
try {
    $service = Get-Service -Name wuauserv -ErrorAction Stop
    $au = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU' -ErrorAction SilentlyContinue
    [PSCustomObject]@{
        running   = $service.Status -eq 'Running'
        startType = $service.StartType.ToString()
        policy    = [bool]($au -and $au.NoAutoUpdate -eq 1)
    } | ConvertTo-Json -Compress
} catch { '' }`)
    const { running, startType, policy } = JSON.parse(output)
    const disabled = !running && startType === 'Disabled'
    return { state: disabled ? 'disabled' : 'enabled', running, startType, policy }
  } catch {
    return { state: 'unknown', running: null, startType: null, policy: null }
  }
}

export async function disableWindowsUpdates() {
  if (!(await isRunningElevated())) return notElevatedResult('disable Windows Update')
  for (const [key, name, type, data] of WU_POLICY_VALUES) {
    const error = await runCommand('reg', ['add', key, '/v', name, '/t', type, '/d', data, '/f'])
    if (error) return { success: false, message: `Couldn't set the ${name} policy: ${error}` }
  }
  const serviceError = await runCommand('sc', ['config', 'wuauserv', 'start=', 'disabled'])
  // Fails harmlessly when the service is already stopped
  await runCommand('net', ['stop', 'wuauserv'])
  const after = await getWindowsUpdateState()
  if (after.running) {
    return {
      success: false,
      message:
        'The policies were written, but the Windows Update service is still running (it may be installing something). Try again in a minute.'
    }
  }
  return {
    success: true,
    message: serviceError
      ? `Windows Update disabled by policy (the service itself couldn't be disabled: ${serviceError}).`
      : 'Windows Update disabled.'
  }
}

export async function enableWindowsUpdates() {
  if (!(await isRunningElevated())) return notElevatedResult('enable Windows Update')
  // Fails harmlessly for values that don't exist
  for (const [key, name] of WU_POLICY_VALUES) {
    await runCommand('reg', ['delete', key, '/v', name, '/f'])
  }
  // "demand" (Manual) is the Windows default for wuauserv
  const serviceError = await runCommand('sc', ['config', 'wuauserv', 'start=', 'demand'])
  if (serviceError) {
    return {
      success: false,
      message: `Couldn't re-enable the Windows Update service: ${serviceError}`
    }
  }
  await runCommand('net', ['start', 'wuauserv'])
  return { success: true, message: 'Windows Update enabled.' }
}

async function generateHtmlReport(args, filePrefix, successMessage, timeoutMs) {
  const outputPath = path.join(os.tmpdir(), `windiag-${filePrefix}-${randomUUID()}.html`)
  try {
    await execFileAsync('powercfg', [...args, '/output', outputPath], {
      windowsHide: true,
      timeout: timeoutMs
    })
    const openError = await shell.openPath(outputPath)
    if (openError) {
      return { success: false, message: openError }
    }
    return { success: true, message: successMessage }
  } catch (err) {
    return { success: false, message: errorMessage(err) }
  }
}

export async function generateBatteryReport() {
  return generateHtmlReport(
    ['/batteryreport'],
    'battery-report',
    'Battery report generated and opened.',
    15e3
  )
}

export async function generateEnergyReport() {
  if (!(await isRunningElevated())) return notElevatedResult('generate the energy report')
  return generateHtmlReport(
    ['/energy'],
    'energy-report',
    'Energy efficiency report generated and opened.',
    75e3
  )
}

export async function isSysprepRunning() {
  try {
    const output = await runPowerShell(
      '[bool](Get-Process -Name sysprep -ErrorAction SilentlyContinue)',
      4e3
    )
    return output.trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}

// Elevation can't change while the process runs, so check once.
let elevatedPromise = null
export function isRunningElevated() {
  elevatedPromise ??= execFileAsync('net', ['session'], { windowsHide: true, timeout: 4e3 }).then(
    () => true,
    () => false
  )
  return elevatedPromise
}

// Win32 ERROR_CANCELLED: the user dismissed the UAC prompt
const ERROR_CANCELLED = 1223

export async function relaunchAsAdmin() {
  const exePath = process.execPath
  const args = process.argv.slice(1).filter((a) => a !== '.')
  const quote = (value) => `'${value.replace(/'/g, "''")}'`
  const argList = args.length ? ` -ArgumentList ${args.map(quote).join(',')}` : ''
  const script = `
try {
    Start-Process -FilePath ${quote(exePath)}${argList} -Verb RunAs -ErrorAction Stop
    'ok'
} catch {
    $code = $_.Exception.NativeErrorCode
    if ($null -eq $code -and $_.Exception.InnerException) { $code = $_.Exception.InnerException.NativeErrorCode }
    if ($code -eq ${ERROR_CANCELLED}) { 'cancelled' } else { 'error:' + $_.Exception.Message }
}`
  try {
    const output = (await runPowerShell(script, 60e3)).trim()
    if (output === 'cancelled') return { success: false, message: 'Elevation was canceled.' }
    if (output !== 'ok') return { success: false, message: output.replace(/^error:/, '') }
    setTimeout(() => app.quit(), 300)
    return { success: true, message: 'Relaunching as Administrator…' }
  } catch (err) {
    return { success: false, message: errorMessage(err) }
  }
}

export async function scheduleCheckDiskOnRestart() {
  const drive = process.env.SystemDrive || 'C:'
  if (!(await isRunningElevated())) return notElevatedResult('schedule a disk check')
  try {
    await execFileAsync('fsutil', ['dirty', 'set', drive], { windowsHide: true, timeout: 5e3 })
    return {
      success: true,
      message: `${drive} has been marked for a disk check on the next restart. It runs automatically next time the computer restarts (large drives can take a while).`
    }
  } catch (err) {
    return { success: false, message: errorMessage(err) }
  }
}
