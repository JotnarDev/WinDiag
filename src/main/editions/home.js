import { runCheck, openWindowsPage } from '../checkup'

/** IPC that only the home edition has. */
export function registerEditionIpc({ handle, expect }) {
  handle('checkup:run', (_event, id) => runCheck(expect('string', id, 'checkup:run')))
  handle('system:open-windows-page', (_event, id) =>
    openWindowsPage(expect('string', id, 'system:open-windows-page'))
  )
}
