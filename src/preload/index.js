import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getStaticSystemInfo: () => ipcRenderer.invoke('system:get-static-info'),
  getWindowsActivation: () => ipcRenderer.invoke('system:get-activation'),
  getDynamicSystemInfo: () => ipcRenderer.invoke('system:get-dynamic-info'),
  setFullscreen: (value) => ipcRenderer.invoke('window:set-fullscreen', value),
  getAppearance: () => ipcRenderer.invoke('window:get-appearance'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  onAppearanceChanged: (callback) => {
    const listener = (_event, appearance) => callback(appearance)
    ipcRenderer.on('window:appearance-changed', listener)
    return () => ipcRenderer.removeListener('window:appearance-changed', listener)
  },
  getUsbPorts: () => ipcRenderer.invoke('ports:get-usb-ports'),
  getOtherDevicesSnapshot: () => ipcRenderer.invoke('otherdevices:get-snapshot'),
  getSmartCardStatus: () => ipcRenderer.invoke('smartcard:get-status'),
  getGpsFix: () => ipcRenderer.invoke('gps:get-fix'),
  getWifiConnectionStatus: () => ipcRenderer.invoke('wifi:get-status'),
  launchSystemTool: (toolId) => ipcRenderer.invoke('system:launch-tool', toolId),
  launchProductKeyDialog: () => ipcRenderer.invoke('system:launch-product-key-dialog'),
  getWindowsUpdateState: () => ipcRenderer.invoke('system:get-update-state'),
  disableWindowsUpdates: () => ipcRenderer.invoke('system:disable-updates'),
  enableWindowsUpdates: () => ipcRenderer.invoke('system:enable-updates'),
  generateBatteryReport: () => ipcRenderer.invoke('system:generate-battery-report'),
  generateEnergyReport: () => ipcRenderer.invoke('system:generate-energy-report'),
  scheduleCheckDiskOnRestart: () => ipcRenderer.invoke('system:schedule-check-disk'),
  getWindowsUsers: () => ipcRenderer.invoke('users:get-list'),
  deleteWindowsUser: (name) => ipcRenderer.invoke('users:delete', name),
  isSysprepRunning: () => ipcRenderer.invoke('system:is-sysprep-running'),
  isElevated: () => ipcRenderer.invoke('system:is-elevated'),
  relaunchAsAdmin: () => ipcRenderer.invoke('system:relaunch-as-admin'),
  getMainDiskHealth: () => ipcRenderer.invoke('disk:get-health'),
  findDefaultDriverFolder: () => ipcRenderer.invoke('drivers:find-default-folder'),
  chooseDriverFolder: (defaultPath) => ipcRenderer.invoke('drivers:choose-folder', defaultPath),
  chooseDriverCatalog: (defaultPath) => ipcRenderer.invoke('drivers:choose-catalog', defaultPath),
  createDriverCatalog: (folder) => ipcRenderer.invoke('drivers:create-catalog', folder),
  updateBios: (updaterPath) => ipcRenderer.invoke('drivers:update-bios', updaterPath),
  scanDrivers: (source) => ipcRenderer.invoke('drivers:scan', source),
  installDriver: (infPath, deviceId) => ipcRenderer.invoke('drivers:install', infPath, deviceId),
  setPrintScreenBlocked: (blocked) =>
    ipcRenderer.invoke('keyboard:set-printscreen-blocked', blocked),
  onPrintScreenPressed: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('keyboard:printscreen-pressed', listener)
    return () => ipcRenderer.removeListener('keyboard:printscreen-pressed', listener)
  },
  setKeyboardCaptureActive: (active) => ipcRenderer.invoke('keyboard:set-capture-active', active),
  setEdgeGesturesDisabled: (disabled) =>
    ipcRenderer.invoke('touch:set-edge-gestures-disabled', disabled),
  onKeyInputEvent: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('keyboard:input-event', listener)
    return () => ipcRenderer.removeListener('keyboard:input-event', listener)
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
