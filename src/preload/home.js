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
  restartExplorer: () => ipcRenderer.invoke('system:restart-explorer'),
  getApps: () => ipcRenderer.invoke('apps:get'),
  getAppsJob: () => ipcRenderer.invoke('apps:get-job'),
  installApps: (ids) => ipcRenderer.invoke('apps:install', ids),
  updateAllApps: () => ipcRenderer.invoke('apps:update-all'),
  stopAppsJob: () => ipcRenderer.invoke('apps:stop'),
  getWindowsUpdates: () => ipcRenderer.invoke('updates:get'),
  getUpdatesJob: () => ipcRenderer.invoke('updates:get-job'),
  installWindowsUpdates: (ids, restorePoint) =>
    ipcRenderer.invoke('updates:install', ids, restorePoint),
  getMakerInfo: () => ipcRenderer.invoke('updates:get-maker'),
  openMakerSupport: () => ipcRenderer.invoke('updates:open-maker-support'),
  restartWindows: () => ipcRenderer.invoke('system:restart'),
  getSecurityStatus: () => ipcRenderer.invoke('security:get-status'),
  updateDefender: () => ipcRenderer.invoke('security:update-defender'),
  quickScan: () => ipcRenderer.invoke('security:quick-scan'),
  turnOnFirewall: () => ipcRenderer.invoke('security:turn-on-firewall'),
  setPuaProtection: (on) => ipcRenderer.invoke('security:set-pua', on),
  openSecurityPage: (id) => ipcRenderer.invoke('security:open-page', id),
  runRepair: (id) => ipcRenderer.invoke('repair:run', id),
  getRepairJob: () => ipcRenderer.invoke('repair:get-job'),
  openSystemRestore: () => ipcRenderer.invoke('repair:open-system-restore'),
  onRepairProgress: (callback) => {
    const listener = (_event, job) => callback(job)
    ipcRenderer.on('repair:progress', listener)
    return () => ipcRenderer.removeListener('repair:progress', listener)
  },
  onUpdatesProgress: (callback) => {
    const listener = (_event, job) => callback(job)
    ipcRenderer.on('updates:progress', listener)
    return () => ipcRenderer.removeListener('updates:progress', listener)
  },
  onAppsProgress: (callback) => {
    const listener = (_event, job) => callback(job)
    ipcRenderer.on('apps:progress', listener)
    return () => ipcRenderer.removeListener('apps:progress', listener)
  }
}
