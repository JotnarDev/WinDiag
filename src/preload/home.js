import { ipcRenderer } from 'electron'

/** Calls only the home edition has. */
export const editionApi = {
  runCheckup: (id) => ipcRenderer.invoke('checkup:run', id),
  openWindowsPage: (id) => ipcRenderer.invoke('system:open-windows-page', id)
}
