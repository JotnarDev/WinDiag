import { ipcRenderer } from 'electron'

/** Calls only WinDiag Bench has: Windows Update mode, users and drivers. */
export const editionApi = {
  getWindowsUpdateState: () => ipcRenderer.invoke('system:get-update-state'),
  setWindowsUpdateMode: (mode) => ipcRenderer.invoke('system:set-update-mode', mode),
  getWindowsUsers: () => ipcRenderer.invoke('users:get-list'),
  deleteWindowsUser: (sid) => ipcRenderer.invoke('users:delete', sid),
  findDefaultDriverFolder: () => ipcRenderer.invoke('drivers:find-default-folder'),
  chooseDriverFolder: (defaultPath) => ipcRenderer.invoke('drivers:choose-folder', defaultPath),
  chooseDriverCatalog: (defaultPath) => ipcRenderer.invoke('drivers:choose-catalog', defaultPath),
  createDriverCatalog: (folder) => ipcRenderer.invoke('drivers:create-catalog', folder),
  updateBios: (key) => ipcRenderer.invoke('drivers:update-bios', key),
  scanDrivers: (request) => ipcRenderer.invoke('drivers:scan', request),
  installDrivers: (items) => ipcRenderer.invoke('drivers:install', items)
}
