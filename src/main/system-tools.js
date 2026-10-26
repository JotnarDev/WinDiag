import { app, shell } from 'electron'
import path from 'path'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)
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

export async function getWindowsUpdateServiceState() {
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -NonInteractive -Command "(Get-Service -Name wuauserv).Status"',
      { windowsHide: true, timeout: 5e3 }
    )
    const value = stdout.trim().toLowerCase()
    if (value === 'running') return 'running'
    if (value === 'stopped') return 'stopped'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

function translateServiceError(raw, verb) {
  if (/access is denied/i.test(raw)) {
    return `Access denied. Close WinDiag and reopen it as Administrator (right-click the app → "Run as administrator") to ${verb} this service.`
  }
  return raw
}

export async function stopWindowsUpdateService() {
  try {
    await execAsync('net stop wuauserv', { windowsHide: true, timeout: 15e3 })
    return { success: true, message: 'Windows Update service stopped.' }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    if (/is not started/i.test(raw)) {
      return { success: true, message: 'Windows Update service was already stopped.' }
    }
    return { success: false, message: translateServiceError(raw, 'stop') }
  }
}

export async function startWindowsUpdateService() {
  try {
    await execAsync('net start wuauserv', { windowsHide: true, timeout: 15e3 })
    return { success: true, message: 'Windows Update service started.' }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    if (/already.*started/i.test(raw)) {
      return { success: true, message: 'Windows Update service was already running.' }
    }
    return { success: false, message: translateServiceError(raw, 'start') }
  }
}

async function generateHtmlReport(command, filePrefix, successMessage, timeoutMs) {
  const outputPath = path.join(os.tmpdir(), `windiag-${filePrefix}-${randomUUID()}.html`)
  try {
    await execAsync(`${command} /output "${outputPath}"`, { windowsHide: true, timeout: timeoutMs })
    const errorMessage = await shell.openPath(outputPath)
    if (errorMessage) {
      return { success: false, message: errorMessage }
    }
    return { success: true, message: successMessage }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function generateBatteryReport() {
  return generateHtmlReport(
    'powercfg /batteryreport',
    'battery-report',
    'Battery report generated and opened.',
    15e3
  )
}

export async function generateEnergyReport() {
  const result = await generateHtmlReport(
    'powercfg /energy',
    'energy-report',
    'Energy efficiency report generated and opened.',
    75e3
  )
  if (!result.success && /access is denied|administrator|elevation/i.test(result.message)) {
    return {
      success: false,
      message:
        'This report requires administrator permission. Close WinDiag and reopen it as Administrator (right-click the app → "Run as administrator"), then try again.'
    }
  }
  return result
}

export async function isSysprepRunning() {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "if (Get-Process -Name sysprep -ErrorAction SilentlyContinue) { 'true' } else { 'false' }"`,
      { windowsHide: true, timeout: 4e3 }
    )
    return stdout.trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}

export async function isRunningElevated() {
  try {
    await execAsync('net session', { windowsHide: true, timeout: 4e3 })
    return true
  } catch {
    return false
  }
}

export async function relaunchAsAdmin() {
  try {
    const exePath = process.execPath
    const args = process.argv.slice(1).filter((a) => a !== '.')
    const escape = (value) => value.replace(/'/g, "''")
    const argListFragment = args.length
      ? ` -ArgumentList ${args.map((a) => `'${escape(a)}'`).join(',')}`
      : ''
    const command = `Start-Process -FilePath '${escape(exePath)}'${argListFragment} -Verb RunAs`
    await execAsync(`powershell -NoProfile -NonInteractive -Command "${command}"`, {
      windowsHide: true,
      timeout: 15e3
    })
    setTimeout(() => app.quit(), 300)
    return { success: true, message: 'Relaunching as Administrator…' }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    if (/cancel/i.test(raw)) {
      return { success: false, message: 'Elevation was canceled.' }
    }
    return { success: false, message: raw }
  }
}

export async function scheduleCheckDiskOnRestart() {
  const drive = process.env.SystemDrive || 'C:'
  try {
    await execAsync(`fsutil dirty set ${drive}`, { windowsHide: true, timeout: 5e3 })
    return {
      success: true,
      message: `${drive} has been marked for a disk check on the next restart. It runs automatically next time the computer restarts (large drives can take a while).`
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    if (/access is denied/i.test(raw)) {
      return {
        success: false,
        message:
          'Access denied. Close WinDiag and reopen it as Administrator (right-click the app → "Run as administrator") to schedule a disk check.'
      }
    }
    return { success: false, message: raw }
  }
}
