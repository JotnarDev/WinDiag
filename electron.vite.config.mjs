import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))

// Two editions from one code base, chosen with --mode:
// - bench (default): WinDiag for refurbishers and technicians
// - home (--mode home): WinDiag for people looking after their own PC
const EDITIONS = ['bench', 'home']

export default defineConfig(({ mode }) => {
  const edition = EDITIONS.includes(mode) ? mode : 'bench'
  const define = { __EDITION__: JSON.stringify(edition) }
  return {
    main: {
      define,
      plugins: [externalizeDepsPlugin()]
    },
    preload: {
      define,
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      define: {
        ...define,
        __APP_VERSION__: JSON.stringify(version)
      },
      resolve: {
        alias: {
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
