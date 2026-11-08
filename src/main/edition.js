import { app } from 'electron'
import path from 'path'

/* global __EDITION__ */

/**
 * The edition this build is (set at build time with electron-vite --mode).
 * Bench keeps the identity WinDiag has always had, so installed copies keep
 * their settings and updates; Home has its own, so both can be installed side
 * by side.
 */
const EDITIONS = {
  bench: {
    id: 'bench',
    appUserModelId: 'com.jotnar.windiag.fluent',
    // Electron's default, from package.json's name
    userDataFolder: null
  },
  home: {
    id: 'home',
    appUserModelId: 'com.jotnar.windiag.home',
    userDataFolder: 'WinDiag'
  }
}

export const EDITION = EDITIONS[__EDITION__] ?? EDITIONS.bench

/** Points settings and the single-instance lock at this edition's folder. Call first. */
export function applyEditionPaths() {
  if (EDITION.userDataFolder) {
    app.setPath('userData', path.join(app.getPath('appData'), EDITION.userDataFolder))
  }
}
