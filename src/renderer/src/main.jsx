import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyPalette, setSystemAccent } from './lib/palette'

let currentSettings = {}

function applyAppearance({ mica, accentColor }) {
  document.documentElement.classList.toggle('mica', mica)
  setSystemAccent(accentColor)
  applyPalette(currentSettings)
}

// The backdrop and accent color are applied (and the settings read) before
// the first paint so the window doesn't flash defaults or the wrong page
const [appearance, settings] = await Promise.all([
  window.api
    .getAppearance()
    .catch(() => ({ mica: false, micaSupported: false, accentColor: null, titleBarHeight: 48 })),
  window.api.getSettings().catch(() => ({}))
])
currentSettings = settings
applyAppearance(appearance)
window.api.onAppearanceChanged(applyAppearance)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App
      titleBarHeight={appearance.titleBarHeight}
      micaSupported={appearance.micaSupported}
      initialSettings={settings}
      onSettingsChange={(next) => (currentSettings = next)}
    />
  </StrictMode>
)
