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
  'Close WinDiag and reopen it as Administrator (use "Run as Administrator" in the sidebar or right-click the app → "Run as administrator")'

export function notElevatedResult(action) {
  return {
    success: false,
    message: `Administrator permission is required to ${action}. ${NOT_ELEVATED_SUFFIX}.`
  }
}

const errorMessage = (err) => (err instanceof Error ? err.message : String(err))

// Stopping wuauserv alone is temporary: Windows starts it again on demand.
// Disabling sets the service start type to Disabled (it can't be started at
// all) and adds the NoAutoUpdate machine policy as a second layer.
const WU_POLICY_KEY = 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU'

const runQuiet = (file, args) =>
  execFileAsync(file, args, { windowsHide: true, timeout: 15e3 }).then(
    () => true,
    () => false
  )

export async function getWindowsUpdateState() {
  try {
    // StartType is an enum, so its name is always English
    const value = (await runPowerShell('(Get-Service -Name wuauserv).StartType.ToString()'))
      .trim()
      .toLowerCase()
    if (value === 'disabled') return 'disabled'
    if (value) return 'enabled'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function disableWindowsUpdates() {
  if ((await getWindowsUpdateState()) === 'disabled') {
    return { success: true, message: 'Windows Update was already disabled.' }
  }
  if (!(await isRunningElevated())) return notElevatedResult('disable Windows Update')
  try {
    await execFileAsync('sc', ['config', 'wuauserv', 'start=', 'disabled'], {
      windowsHide: true,
      timeout: 15e3
    })
  } catch (err) {
    return { success: false, message: errorMessage(err) }
  }
  // Exit codes here also cover "already stopped" / "value already set"
  await runQuiet('net', ['stop', 'wuauserv'])
  await runQuiet('reg', [
    'add',
    WU_POLICY_KEY,
    '/v',
    'NoAutoUpdate',
    '/t',
    'REG_DWORD',
    '/d',
    '1',
    '/f'
  ])
  return { success: true, message: 'Windows Update disabled.' }
}

export async function enableWindowsUpdates() {
  if (!(await isRunningElevated())) return notElevatedResult('enable Windows Update')
  try {
    // "demand" (Manual) is the Windows default for wuauserv
    await execFileAsync('sc', ['config', 'wuauserv', 'start=', 'demand'], {
      windowsHide: true,
      timeout: 15e3
    })
  } catch (err) {
    return { success: false, message: errorMessage(err) }
  }
  // Fails harmlessly when the policy value doesn't exist
  await runQuiet('reg', ['delete', WU_POLICY_KEY, '/v', 'NoAutoUpdate', '/f'])
  await runQuiet('net', ['start', 'wuauserv'])
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
