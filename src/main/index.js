import { BrowserWindow, app, globalShortcut, ipcMain, shell } from 'electron'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getStaticSystemInfo, getDynamicSystemInfo, getFanInfo } from './system-info'
import { getPortsSnapshot } from './ports'
import {
  getOtherDevicesSnapshot,
  getSmartCardStatus,
  getGpsFix,
  getWifiConnectionStatus
} from './other-devices'
import {
  launchSystemTool,
  launchProductKeyDialog,
  getWindowsUpdateServiceState,
  stopWindowsUpdateService,
  startWindowsUpdateService,
  generateBatteryReport,
  generateEnergyReport,
  scheduleCheckDiskOnRestart,
  isSysprepRunning,
  isRunningElevated,
  relaunchAsAdmin
} from './system-tools'
import { getWindowsUsers, deleteWindowsUser } from './users'
import { getMainDiskHealth } from './disk-health'

const execAsync = promisify(exec)
const LOCK_KEY_SENDKEYS = {
  CapsLock: '{CAPSLOCK}',
  NumLock: '{NUMLOCK}'
}

let keyboardCaptureActive = false
let edgeSwipeSnapshot = null
const EDGE_UI_REG_PATH = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\EdgeUI'
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // The Windows/macOS packaged build gets its icon from build/icon.ico
    // (via electron-builder) automatically, but that only applies to a
    // built .exe — running via `npm run dev` launches the raw Electron
    // binary directly, which has no icon of its own, so the window/taskbar
    // icon has to be set explicitly here too, for every platform, not just
    // the Linux case the electron-vite template started with.
    icon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!keyboardCaptureActive) return
    if (input.code === 'Escape') return
    if (input.type !== 'keyDown' && input.type !== 'keyUp') return
    event.preventDefault()
    const payload = {
      code: input.code,
      type: input.type,
      isAutoRepeat: input.isAutoRepeat
    }
    mainWindow.webContents.send('keyboard:input-event', payload)
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jotnar.windiag')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('system:get-static-info', () => getStaticSystemInfo())
  ipcMain.handle('system:get-dynamic-info', () => getDynamicSystemInfo())
  ipcMain.handle('system:get-fan-info', () => getFanInfo())
  ipcMain.handle('ports:get-snapshot', () => getPortsSnapshot())
  ipcMain.handle('otherdevices:get-snapshot', () => getOtherDevicesSnapshot())
  ipcMain.handle('smartcard:get-status', () => getSmartCardStatus())
  ipcMain.handle('gps:get-fix', () => getGpsFix())
  ipcMain.handle('wifi:get-status', () => getWifiConnectionStatus())
  ipcMain.handle('system:launch-tool', (_event, toolId) => launchSystemTool(toolId))
  ipcMain.handle('system:launch-product-key-dialog', () => launchProductKeyDialog())
  ipcMain.handle('system:get-update-service-state', () => getWindowsUpdateServiceState())
  ipcMain.handle('system:stop-update-service', () => stopWindowsUpdateService())
  ipcMain.handle('system:start-update-service', () => startWindowsUpdateService())
  ipcMain.handle('system:generate-battery-report', () => generateBatteryReport())
  ipcMain.handle('system:generate-energy-report', () => generateEnergyReport())
  ipcMain.handle('system:schedule-check-disk', () => scheduleCheckDiskOnRestart())
  ipcMain.handle('users:get-list', () => getWindowsUsers())
  ipcMain.handle('users:delete', (_event, name) => deleteWindowsUser(name))
  ipcMain.handle('system:is-sysprep-running', () => isSysprepRunning())
  ipcMain.handle('system:is-elevated', () => isRunningElevated())
  ipcMain.handle('system:relaunch-as-admin', () => relaunchAsAdmin())
  ipcMain.handle('disk:get-health', () => getMainDiskHealth())
  ipcMain.handle('window:set-fullscreen', (_event, shouldBeFullscreen) => {
    const [win] = BrowserWindow.getAllWindows()
    win?.setFullScreen(shouldBeFullscreen)
  })
  ipcMain.handle('keyboard:set-printscreen-blocked', (_event, blocked) => {
    if (blocked) {
      globalShortcut.register('PrintScreen', () => {
        const [win] = BrowserWindow.getAllWindows()
        win?.webContents.send('keyboard:printscreen-pressed')
      })
    } else {
      globalShortcut.unregister('PrintScreen')
    }
  })
  ipcMain.handle('keyboard:set-capture-active', (_event, active) => {
    keyboardCaptureActive = active
  })
  ipcMain.handle('keyboard:revert-lock-key', async (_event, key) => {
    const token = LOCK_KEY_SENDKEYS[key]
    if (!token) return
    try {
      await execAsync(
        `powershell -NoProfile -NonInteractive -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${token}')"`,
        { windowsHide: true, timeout: 3e3 }
      )
    } catch {}
  })
  ipcMain.handle('touch:set-edge-gestures-disabled', async (_event, disabled) => {
    try {
      if (disabled) {
        if (edgeSwipeSnapshot) return
        const { stdout } = await execAsync(
          `powershell -NoProfile -NonInteractive -Command "New-Item -Path '${EDGE_UI_REG_PATH}' -Force | Out-Null; $existing = $null; try { $existing = (Get-ItemProperty -Path '${EDGE_UI_REG_PATH}' -Name 'AllowEdgeSwipe' -ErrorAction Stop).AllowEdgeSwipe } catch {}; Set-ItemProperty -Path '${EDGE_UI_REG_PATH}' -Name 'AllowEdgeSwipe' -Value 0 -Type DWord; if ($null -eq $existing) { Write-Output '__MISSING__' } else { Write-Output $existing }"`,
          { windowsHide: true, timeout: 5e3 }
        )
        const result = stdout.trim()
        edgeSwipeSnapshot = { originalValue: result === '__MISSING__' || !result ? null : result }
      } else {
        if (!edgeSwipeSnapshot) return
        const { originalValue } = edgeSwipeSnapshot
        edgeSwipeSnapshot = null
        if (originalValue === null) {
          await execAsync(
            `powershell -NoProfile -NonInteractive -Command "Remove-ItemProperty -Path '${EDGE_UI_REG_PATH}' -Name 'AllowEdgeSwipe' -ErrorAction SilentlyContinue"`,
            { windowsHide: true, timeout: 5e3 }
          )
        } else {
          await execAsync(
            `powershell -NoProfile -NonInteractive -Command "Set-ItemProperty -Path '${EDGE_UI_REG_PATH}' -Name 'AllowEdgeSwipe' -Value ${originalValue} -Type DWord"`,
            { windowsHide: true, timeout: 5e3 }
          )
        }
      }
    } catch {}
  })
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (edgeSwipeSnapshot) {
    const { originalValue } = edgeSwipeSnapshot
    edgeSwipeSnapshot = null
    const command =
      originalValue === null
        ? `Remove-ItemProperty -Path '${EDGE_UI_REG_PATH}' -Name 'AllowEdgeSwipe' -ErrorAction SilentlyContinue`
        : `Set-ItemProperty -Path '${EDGE_UI_REG_PATH}' -Name 'AllowEdgeSwipe' -Value ${originalValue} -Type DWord`
    void execAsync(`powershell -NoProfile -NonInteractive -Command "${command}"`, {
      windowsHide: true,
      timeout: 5e3
    }).catch(() => void 0)
  }
})
