import { BrowserWindow, app, globalShortcut, ipcMain, shell } from 'electron'
import path from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import si from 'systeminformation'
import icon from '../../resources/icon.png?asset'
import { runPowerShell, stopPowerShell } from './powershell'
import { getStaticSystemInfo, getDynamicSystemInfo } from './system-info'
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
  getWindowsUpdateState,
  disableWindowsUpdates,
  enableWindowsUpdates,
  generateBatteryReport,
  generateEnergyReport,
  scheduleCheckDiskOnRestart,
  isSysprepRunning,
  isRunningElevated,
  relaunchAsAdmin
} from './system-tools'
import { getWindowsUsers, deleteWindowsUser } from './users'
import { getMainDiskHealth } from './disk-health'
import {
  recoverEdgeGestures,
  restoreEdgeGesturesSync,
  setEdgeGesturesDisabled
} from './edge-gestures'

const LOCK_KEY_SENDKEYS = {
  CapsLock: '{CAPSLOCK}',
  NumLock: '{NUMLOCK}'
}
// Reverting a lock key injects a synthetic key press, which comes back
// through before-input-event. Swallow events for that key for a moment so the
// revert isn't itself treated as a new press (and reverted again, forever).
const LOCK_KEY_SUPPRESS_MS = 1000
const lockKeySuppressedUntil = {}

let keyboardCaptureActive = false

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
      sandbox: true,
      // No text fields need it, and it loads spellcheck dictionaries
      spellcheck: false
    }
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!keyboardCaptureActive) return
    if (input.code === 'Escape') return
    if (input.type !== 'keyDown' && input.type !== 'keyUp') return
    event.preventDefault()
    if (Date.now() < (lockKeySuppressedUntil[input.code] ?? 0)) return
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

// Only WinDiag's own page may call into the main process — several handlers
// can stop services or delete accounts.
function isTrustedSender(event) {
  const url = event.senderFrame?.url ?? ''
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return url.startsWith(process.env['ELECTRON_RENDERER_URL'])
  }
  return url.startsWith('file://')
}

function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error(`Blocked ${channel} from an untrusted page`)
    return listener(event, ...args)
  })
}

function expect(type, value, channel) {
  if (typeof value !== type) throw new TypeError(`${channel}: expected a ${type}`)
  return value
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jotnar.windiag')
  // Keep a single PowerShell process alive for systeminformation's queries
  // instead of it spawning a new one per call.
  if (process.platform === 'win32') si.powerShellStart()
  void recoverEdgeGestures()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  handle('system:get-static-info', () => getStaticSystemInfo())
  handle('system:get-dynamic-info', () => getDynamicSystemInfo())
  handle('ports:get-snapshot', () => getPortsSnapshot())
  handle('otherdevices:get-snapshot', () => getOtherDevicesSnapshot())
  handle('smartcard:get-status', () => getSmartCardStatus())
  handle('gps:get-fix', () => getGpsFix())
  handle('wifi:get-status', () => getWifiConnectionStatus())
  handle('system:launch-tool', (_event, toolId) =>
    launchSystemTool(expect('string', toolId, 'system:launch-tool'))
  )
  handle('system:launch-product-key-dialog', () => launchProductKeyDialog())
  handle('system:get-update-state', () => getWindowsUpdateState())
  handle('system:disable-updates', () => disableWindowsUpdates())
  handle('system:enable-updates', () => enableWindowsUpdates())
  handle('system:generate-battery-report', () => generateBatteryReport())
  handle('system:generate-energy-report', () => generateEnergyReport())
  handle('system:schedule-check-disk', () => scheduleCheckDiskOnRestart())
  handle('users:get-list', () => getWindowsUsers())
  handle('users:delete', (_event, name) =>
    deleteWindowsUser(expect('string', name, 'users:delete'))
  )
  handle('system:is-sysprep-running', () => isSysprepRunning())
  handle('system:is-elevated', () => isRunningElevated())
  handle('system:relaunch-as-admin', () => relaunchAsAdmin())
  handle('disk:get-health', () => getMainDiskHealth())
  handle('window:set-fullscreen', (event, shouldBeFullscreen) => {
    BrowserWindow.fromWebContents(event.sender)?.setFullScreen(
      expect('boolean', shouldBeFullscreen, 'window:set-fullscreen')
    )
  })
  handle('keyboard:set-printscreen-blocked', (event, blocked) => {
    if (expect('boolean', blocked, 'keyboard:set-printscreen-blocked')) {
      const sender = event.sender
      globalShortcut.register('PrintScreen', () => {
        if (!sender.isDestroyed()) sender.send('keyboard:printscreen-pressed')
      })
    } else {
      globalShortcut.unregister('PrintScreen')
    }
  })
  handle('keyboard:set-capture-active', (_event, active) => {
    keyboardCaptureActive = expect('boolean', active, 'keyboard:set-capture-active')
  })
  handle('keyboard:revert-lock-key', async (_event, key) => {
    const token = LOCK_KEY_SENDKEYS[key]
    if (!token) return
    lockKeySuppressedUntil[key] = Date.now() + LOCK_KEY_SUPPRESS_MS
    try {
      await runPowerShell(
        `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${token}')`,
        3e3
      )
    } catch {
      // best effort: the key just stays toggled
    }
  })
  handle('touch:set-edge-gestures-disabled', (_event, disabled) =>
    setEdgeGesturesDisabled(expect('boolean', disabled, 'touch:set-edge-gestures-disabled'))
  )

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
  restoreEdgeGesturesSync()
  stopPowerShell()
  if (process.platform === 'win32') si.powerShellRelease()
})
