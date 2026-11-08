import { runCheck, openWindowsPage } from '../checkup'
import {
  getPowerMode,
  getStartupApps,
  runCleanup,
  scanCleanup,
  setPowerMode,
  setStartupApp
} from '../speed'

/** IPC that only the home edition has. */
export function registerEditionIpc({ handle, expect }) {
  handle('checkup:run', (_event, id) => runCheck(expect('string', id, 'checkup:run')))
  handle('system:open-windows-page', (_event, id) =>
    openWindowsPage(expect('string', id, 'system:open-windows-page'))
  )
  handle('speed:get-startup-apps', () => getStartupApps())
  handle('speed:set-startup-app', (_event, id, enabled) =>
    setStartupApp(
      expect('string', id, 'speed:set-startup-app'),
      expect('boolean', enabled, 'speed:set-startup-app')
    )
  )
  handle('speed:scan-cleanup', () => scanCleanup())
  handle('speed:run-cleanup', (_event, id) => runCleanup(expect('string', id, 'speed:run-cleanup')))
  handle('speed:get-power-mode', () => getPowerMode())
  handle('speed:set-power-mode', (_event, mode) =>
    setPowerMode(expect('string', mode, 'speed:set-power-mode'))
  )
}
