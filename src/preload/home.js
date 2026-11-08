import { ipcRenderer } from 'electron'

/** Calls only the home edition has. */
export const editionApi = {
  runCheckup: (id) => ipcRenderer.invoke('checkup:run', id),
  openWindowsPage: (id) => ipcRenderer.invoke('system:open-windows-page', id),
  getStartupApps: () => ipcRenderer.invoke('speed:get-startup-apps'),
  setStartupApp: (id, enabled) => ipcRenderer.invoke('speed:set-startup-app', id, enabled),
  scanCleanup: () => ipcRenderer.invoke('speed:scan-cleanup'),
  runCleanup: (id) => ipcRenderer.invoke('speed:run-cleanup', id),
  getPowerMode: () => ipcRenderer.invoke('speed:get-power-mode'),
  setPowerMode: (mode) => ipcRenderer.invoke('speed:set-power-mode', mode),
  getPrivacySettings: () => ipcRenderer.invoke('privacy:get-settings'),
  setPrivacySettings: (changes) => ipcRenderer.invoke('privacy:set-settings', changes),
  getPersonalizeSettings: () => ipcRenderer.invoke('personalize:get-settings'),
  setPersonalizeSettings: (changes) => ipcRenderer.invoke('personalize:set-settings', changes),
  restartExplorer: () => ipcRenderer.invoke('system:restart-explorer')
}
