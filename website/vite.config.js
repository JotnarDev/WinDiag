import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative base so the build works from GitHub Pages (/WinDiag/) or any folder
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()]
})
