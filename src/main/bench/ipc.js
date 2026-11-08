import { BrowserWindow } from 'electron'
import { getWindowsUpdateState, setWindowsUpdateMode } from './windows-update'
import { getWindowsUsers, deleteWindowsUser } from './users'
import {
  chooseCatalogFile,
  chooseDriverFolder,
  createCatalog,
  findDefaultDriverFolder,
  installDrivers,
  launchBiosUpdate,
  scanDrivers
} from './drivers'

/** IPC that only WinDiag Bench has: Windows Update mode, users and drivers. */
export function registerEditionIpc({ handle, expect }) {
  handle('system:get-update-state', () => getWindowsUpdateState())
  handle('system:set-update-mode', (_event, mode) =>
    setWindowsUpdateMode(expect('string', mode, 'system:set-update-mode'))
  )
  handle('users:get-list', () => getWindowsUsers())
  handle('users:delete', (_event, sid) => deleteWindowsUser(expect('string', sid, 'users:delete')))
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
      windowsUpdate: request?.windowsUpdate === true,
      makers: request?.makers === true
    })
  })
  handle('drivers:install', (_event, items) => {
    if (!Array.isArray(items)) throw new TypeError('drivers:install: expected a list')
    return installDrivers(items)
  })
}
