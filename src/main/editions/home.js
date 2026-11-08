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
import {
  getMakerInfo,
  getUpdatesJob,
  getWindowsUpdates,
  installWindowsUpdates,
  openMakerSupport,
  restartWindows
} from '../updates'
import {
  getSecurityStatus,
  openSecurityPage,
  quickScan,
  setPuaProtection,
  turnOnFirewall,
  updateDefender
} from '../security'

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
  handle('updates:get', () => getWindowsUpdates())
  handle('updates:get-job', () => getUpdatesJob())
  handle('updates:install', (event, ids, restorePoint) => {
    if (!Array.isArray(ids) || ids.length > 200) throw new TypeError('updates:install')
    return installWindowsUpdates(
      ids.map((id) => expect('string', id, 'updates:install')),
      expect('boolean', restorePoint, 'updates:install'),
      event.sender
    )
  })
  handle('updates:get-maker', () => getMakerInfo())
  handle('updates:open-maker-support', () => openMakerSupport())
  handle('system:restart', () => restartWindows())
  handle('security:get-status', () => getSecurityStatus())
  handle('security:update-defender', () => updateDefender())
  handle('security:quick-scan', () => quickScan())
  handle('security:turn-on-firewall', () => turnOnFirewall())
  handle('security:set-pua', (_event, on) =>
    setPuaProtection(expect('boolean', on, 'security:set-pua'))
  )
  handle('security:open-page', (_event, id) =>
    openSecurityPage(expect('string', id, 'security:open-page'))
  )
}
