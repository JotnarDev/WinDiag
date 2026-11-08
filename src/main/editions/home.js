import { runCheck, openWindowsPage } from '../checkup'
import {
  getPowerMode,
  getStartupApps,
  runCleanup,
  scanCleanup,
  setPowerMode,
  setStartupApp
} from '../speed'
import { getPrivacySettings, restartExplorer, setPrivacySettings } from '../privacy'
import { getPersonalizeSettings, setPersonalizeSettings } from '../personalize'
import { getApps, getAppsJob, installApps, stopAppsJob, updateAllApps } from '../apps'

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
  handle('privacy:get-settings', () => getPrivacySettings())
  handle('privacy:set-settings', (_event, changes) => {
    if (!Array.isArray(changes) || changes.length > 50) throw new TypeError('privacy:set-settings')
    return setPrivacySettings(
      changes.map((c) => ({
        id: expect('string', c?.id, 'privacy:set-settings'),
        on: expect('boolean', c?.on, 'privacy:set-settings')
      }))
    )
  })
  handle('personalize:get-settings', () => getPersonalizeSettings())
  handle('personalize:set-settings', (_event, changes) => {
    if (!Array.isArray(changes) || changes.length > 50)
      throw new TypeError('personalize:set-settings')
    return setPersonalizeSettings(
      changes.map((c) => ({
        id: expect('string', c?.id, 'personalize:set-settings'),
        option: expect('string', c?.option, 'personalize:set-settings')
      }))
    )
  })
  handle('system:restart-explorer', () => restartExplorer())
  handle('apps:get', () => getApps())
  handle('apps:get-job', () => getAppsJob())
  handle('apps:install', (event, ids) => {
    if (!Array.isArray(ids) || ids.length > 100) throw new TypeError('apps:install')
    return installApps(
      ids.map((id) => expect('string', id, 'apps:install')),
      event.sender
    )
  })
  handle('apps:update-all', (event) => updateAllApps(event.sender))
  handle('apps:stop', () => stopAppsJob())
}
