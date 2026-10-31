import {
  BrowserWindow,
  app,
  globalShortcut,
  ipcMain,
  nativeTheme,
  screen,
  shell,
  systemPreferences
} from 'electron'
import os from 'os'
import path from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import si from 'systeminformation'
import icon from '../../resources/icon.png?asset'
import { runPowerShell, stopPowerShell } from './powershell'
import { getStaticSystemInfo, getDynamicSystemInfo, getWindowsActivation } from './system-info'
import { getUsbPorts } from './ports'
import {
  getOtherDevicesSnapshot,
  getSmartCardStatus,
  getGpsFix,
  getWifiConnectionStatus
} from './other-devices'
import {
  launchSystemTool,
  launchProductKeyDialog,
  generateBatteryReport,
  generateEnergyReport,
  scheduleCheckDiskOnRestart,
  isSysprepRunning,
  isRunningElevated,
  relaunchAsAdmin
} from './system-tools'
import { getWindowsUpdateState, setWindowsUpdateMode } from './windows-update'
import { getWindowsUsers, deleteWindowsUser } from './users'
import { getMainDiskHealth } from './disk-health'
import {
  recoverEdgeGestures,
  restoreEdgeGesturesSync,
  setEdgeGesturesDisabled
} from './edge-gestures'
import { startKeyboardHook, stopKeyboardHook } from './keyboard-hook'
import { getSettings, resetSettings, updateSettings } from './settings'
import {
  chooseCatalogFile,
  chooseDriverFolder,
  createCatalog,
  findDefaultDriverFolder,
  installDrivers,
  launchBiosUpdate,
  scanDrivers
} from './drivers'

// Only used when the keyboard hook couldn't start: the keys then reach
// Windows, so a lock key toggles and has to be toggled back.
const LOCK_KEY_SENDKEYS = {
  CapsLock: '{CAPSLOCK}',
  NumLock: '{NUMLOCK}',
  ScrollLock: '{SCROLLLOCK}'
}
// Reverting a lock key injects a synthetic key press, which comes back
// through before-input-event. Swallow events for that key for a moment so the
// revert isn't itself treated as a new press (and reverted again, forever).
const LOCK_KEY_SUPPRESS_MS = 1000
const lockKeySuppressedUntil = {}

let keyboardCaptureActive = false

async function revertLockKey(code) {
  lockKeySuppressedUntil[code] = Date.now() + LOCK_KEY_SUPPRESS_MS
  try {
    await runPowerShell(
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${LOCK_KEY_SENDKEYS[code]}')`,
      3e3
    )
  } catch {
    // best effort: the key just stays toggled
  }
}

// Mica (the Windows 11 window backdrop) needs Windows 11 22H2, build 22621
const supportsMica =
  process.platform === 'win32' && Number(os.release().split('.')[2] ?? 0) >= 22621

// Height of the app's own title bar; the caption buttons are drawn to match
const TITLE_BAR_HEIGHT = 48

const titleBarOverlay = () => ({
  color: '#00000000',
  symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#1a1a1a',
  height: TITLE_BAR_HEIGHT
})

// The transparency setting can turn Mica off where it's supported
const useMica = () => supportsMica && getSettings().transparency

const solidBackground = () => (nativeTheme.shouldUseDarkColors ? '#202020' : '#f3f3f3')

function applyBackdrop(win) {
  if (supportsMica) win.setBackgroundMaterial(useMica() ? 'mica' : 'none')
  win.setBackgroundColor(useMica() ? '#00000000' : solidBackground())
}

function getAppearance() {
  return {
    mica: useMica(),
    micaSupported: supportsMica,
    // 'RRGGBBAA' on Windows; null elsewhere so the renderer keeps its default
    accentColor:
      process.platform === 'win32' ? `#${systemPreferences.getAccentColor().slice(0, 6)}` : null,
    titleBarHeight: TITLE_BAR_HEIGHT
  }
}

function createWindow() {
  // Most units run at 150% scaling, where a 1366×768 panel is only ~910×512
  // pixels of layout space, so size the window from the work area instead of
  // a fixed size that may not fit.
  const { width: workWidth, height: workHeight } = screen.getPrimaryDisplay().workAreaSize
  const mainWindow = new BrowserWindow({
    width: Math.min(1100, workWidth),
    height: Math.min(760, workHeight),
    minWidth: Math.min(640, workWidth),
    minHeight: Math.min(480, workHeight),
    show: false,
    autoHideMenuBar: true,
    // The app draws its own title bar (Windows 11 style); Windows still
    // draws the minimize/maximize/close buttons over it.
    titleBarStyle: 'hidden',
    titleBarOverlay: titleBarOverlay(),
    ...(useMica()
      ? { backgroundMaterial: 'mica', backgroundColor: '#00000000' }
      : { backgroundColor: solidBackground() }),
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
  // Follow the Windows light/dark setting and accent color while running
  const handleThemeUpdated = () => {
    if (mainWindow.isDestroyed()) return
    mainWindow.setTitleBarOverlay(titleBarOverlay())
    if (!useMica()) mainWindow.setBackgroundColor(solidBackground())
  }
  const handleAccentChanged = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:appearance-changed', getAppearance())
    }
  }
  nativeTheme.on('updated', handleThemeUpdated)
  if (process.platform === 'win32') {
    systemPreferences.on('accent-color-changed', handleAccentChanged)
  }
  mainWindow.on('closed', () => {
    nativeTheme.off('updated', handleThemeUpdated)
    if (process.platform === 'win32') {
      systemPreferences.off('accent-color-changed', handleAccentChanged)
    }
  })
  // The IPC handlers trust any file:// page, so the window must never leave
  // WinDiag's own page (a dropped file or a stray link would navigate it)
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // While the keyboard hook runs, keys never reach the window; this is the
  // fallback for when it couldn't start (and for injected keys).
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!keyboardCaptureActive) return
    if (input.type !== 'keyDown' && input.type !== 'keyUp') return
    event.preventDefault()
    if (Date.now() < (lockKeySuppressedUntil[input.code] ?? 0)) return
    if (input.type === 'keyDown' && !input.isAutoRepeat && LOCK_KEY_SENDKEYS[input.code]) {
      void revertLockKey(input.code)
    }
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

// Applies the settings that live in the main process (theme, backdrop) and
// tells the page about the new appearance
function applySettings() {
  nativeTheme.themeSource = getSettings().theme
  for (const win of BrowserWindow.getAllWindows()) {
    applyBackdrop(win)
    win.webContents.send('window:appearance-changed', getAppearance())
  }
  return getSettings()
}

// A second copy would start its own PowerShell session and keyboard hook and
// fight over the edge-gesture setting, so it just brings this window forward
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })
  app.whenReady().then(startApp)
}

function startApp() {
  nativeTheme.themeSource = getSettings().theme
  electronApp.setAppUserModelId('com.jotnar.windiag.fluent')
  // Keep a single PowerShell process alive for systeminformation's queries
  // instead of it spawning a new one per call.
  if (process.platform === 'win32') si.powerShellStart()
  void recoverEdgeGestures()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  handle('system:get-static-info', () => getStaticSystemInfo())
  handle('system:get-activation', () => getWindowsActivation())
  handle('system:get-dynamic-info', () => getDynamicSystemInfo())
  handle('ports:get-usb-ports', () => getUsbPorts())
  handle('otherdevices:get-snapshot', () => getOtherDevicesSnapshot())
  handle('smartcard:get-status', () => getSmartCardStatus())
  handle('gps:get-fix', () => getGpsFix())
  handle('wifi:get-status', () => getWifiConnectionStatus())
  handle('system:launch-tool', (_event, toolId) =>
    launchSystemTool(expect('string', toolId, 'system:launch-tool'))
  )
  handle('system:launch-product-key-dialog', () => launchProductKeyDialog())
  handle('system:get-update-state', () => getWindowsUpdateState())
  handle('system:set-update-mode', (_event, mode) =>
    setWindowsUpdateMode(expect('string', mode, 'system:set-update-mode'))
  )
  handle('system:generate-battery-report', () => generateBatteryReport())
  handle('system:generate-energy-report', () => generateEnergyReport())
  handle('system:schedule-check-disk', () => scheduleCheckDiskOnRestart())
  handle('users:get-list', () => getWindowsUsers())
  handle('users:delete', (_event, sid) => deleteWindowsUser(expect('string', sid, 'users:delete')))
  handle('system:is-sysprep-running', () => isSysprepRunning())
  handle('system:is-elevated', () => isRunningElevated())
  handle('system:relaunch-as-admin', () => relaunchAsAdmin())
  handle('disk:get-health', () => getMainDiskHealth())
  handle('drivers:find-default-folder', () => findDefaultDriverFolder())
  handle('drivers:choose-folder', (event, defaultPath) =>
    chooseDriverFolder(
      BrowserWindow.fromWebContents(event.sender),
      typeof defaultPath === 'string' ? defaultPath : undefined
    )
  )
  handle('drivers:choose-catalog', (event, defaultPath) =>
    chooseCatalogFile(
      BrowserWindow.fromWebContents(event.sender),
      typeof defaultPath === 'string' ? defaultPath : undefined
    )
  )
  handle('drivers:create-catalog', (event, folder) =>
    createCatalog(
      BrowserWindow.fromWebContents(event.sender),
      expect('string', folder, 'drivers:create-catalog')
    )
  )
  handle('drivers:update-bios', (_event, key) =>
    launchBiosUpdate(expect('string', key, 'drivers:update-bios'))
  )
  handle('drivers:scan', (_event, request) => {
    const local = request?.local ?? null
    if (local !== null && !['folder', 'catalog'].includes(local?.kind))
      throw new TypeError('drivers:scan')
    return scanDrivers({
      local: local && { kind: local.kind, path: expect('string', local.path, 'drivers:scan') },
      windowsUpdate: request?.windowsUpdate === true
    })
  })
  handle('drivers:install', (_event, items) => {
    if (!Array.isArray(items)) throw new TypeError('drivers:install: expected a list')
    return installDrivers(items)
  })
  handle('window:get-appearance', () => getAppearance())
  handle('settings:get', () => getSettings())
  handle('settings:update', (_event, patch) => {
    if (typeof patch !== 'object' || patch === null) throw new TypeError('settings:update')
    updateSettings(patch)
    return applySettings()
  })
  handle('settings:reset', () => {
    resetSettings()
    return applySettings()
  })
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
  // Resolves with whether system keys are being intercepted by the hook, or
  // 'off' when that's turned off in Settings
  handle('keyboard:set-capture-active', (event, active) => {
    keyboardCaptureActive = expect('boolean', active, 'keyboard:set-capture-active')
    if (!keyboardCaptureActive) {
      stopKeyboardHook()
      return false
    }
    if (!getSettings().blockSystemKeys) return 'off'
    const sender = event.sender
    return startKeyboardHook((payload) => {
      if (!sender.isDestroyed()) sender.send('keyboard:input-event', payload)
    })
  })
  handle('touch:set-edge-gestures-disabled', (_event, disabled) =>
    setEdgeGesturesDisabled(expect('boolean', disabled, 'touch:set-edge-gestures-disabled'))
  )

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopKeyboardHook()
  restoreEdgeGesturesSync()
  stopPowerShell()
  if (process.platform === 'win32') si.powerShellRelease()
})
