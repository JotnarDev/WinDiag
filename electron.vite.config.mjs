import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))

// Two editions from one code base, chosen with --mode:
// - bench: WinDiag Bench, for refurbishers and technicians. Its code lives in
//   bench/ folders that only the private repository has.
// - home: WinDiag, for people looking after their own PC (public).
// Each edition's own code comes in through three aliases, so a build never
// contains the other edition's pages.
const EDITION_ENTRIES = {
  bench: {
    ipc: 'src/main/bench/ipc.js',
    api: 'src/preload/bench.js',
    pages: 'src/renderer/src/bench/edition.js'
  },
  home: {
    ipc: 'src/main/editions/home.js',
    api: 'src/preload/home.js',
    pages: 'src/renderer/src/editions/home.js'
  }
}

// Bench when its code is here, otherwise home
const AVAILABLE = Object.keys(EDITION_ENTRIES).filter((id) =>
  existsSync(resolve(EDITION_ENTRIES[id].pages))
)

export default defineConfig(({ mode }) => {
  if (mode in EDITION_ENTRIES && !AVAILABLE.includes(mode)) {
    throw new Error(`The ${mode} edition's code isn't in this repository.`)
  }
  const edition = AVAILABLE.includes(mode) ? mode : AVAILABLE[0]
  const entries = EDITION_ENTRIES[edition]
  const define = { __EDITION__: JSON.stringify(edition) }
  return {
    main: {
      define,
      resolve: { alias: { '@edition-ipc': resolve(entries.ipc) } },
      plugins: [externalizeDepsPlugin()]
    },
    preload: {
      define,
      resolve: { alias: { '@edition-api': resolve(entries.api) } },
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      define: {
        ...define,
        __APP_VERSION__: JSON.stringify(version)
      },
      resolve: {
        alias: {
          '@edition': resolve(entries.pages),
          '@': resolve('src/renderer/src')
        }
      },
      build: {
        minify: true
      },
      plugins: [react(), tailwindcss()]
    }
  }
})
