import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getStaticSystemInfo: () => ipcRenderer.invoke('system:get-static-info'),
  getDynamicSystemInfo: () => ipcRenderer.invoke('system:get-dynamic-info'),
  setFullscreen: (value) => ipcRenderer.invoke('window:set-fullscreen', value),
  getPortsSnapshot: () => ipcRenderer.invoke('ports:get-snapshot'),
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
  setPrintScreenBlocked: (blocked) =>
    ipcRenderer.invoke('keyboard:set-printscreen-blocked', blocked),
  onPrintScreenPressed: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('keyboard:printscreen-pressed', listener)
    return () => ipcRenderer.removeListener('keyboard:printscreen-pressed', listener)
  },
  revertLockKeyToggle: (key) => ipcRenderer.invoke('keyboard:revert-lock-key', key),
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
