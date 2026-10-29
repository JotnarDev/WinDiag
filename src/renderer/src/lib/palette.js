// Color palettes: an accent (every accent shade is derived from it in
// main.css) and an optional tint mixed into the window background.
export const PALETTES = [
  { id: 'system', label: 'Windows', accent: null, tint: null },
  { id: 'ocean', label: 'Ocean', accent: '#0063b1', tint: '#2b88d8' },
  { id: 'forest', label: 'Forest', accent: '#107c41', tint: '#3a9a5b' },
  { id: 'sunset', label: 'Sunset', accent: '#ca5010', tint: '#f08a4b' },
  { id: 'grape', label: 'Grape', accent: '#7a4fb0', tint: '#9a7dd0' },
  { id: 'slate', label: 'Slate', accent: '#4a6274', tint: '#7a8b97' },
  { id: 'custom', label: 'Custom', accent: null, tint: null }
]

const DEFAULT_ACCENT = '#0078d4'
let systemAccent = null

export const getSystemAccent = () => systemAccent ?? DEFAULT_ACCENT

/** The Windows accent, used by the "Windows" palette. */
export function setSystemAccent(color) {
  systemAccent = color
}

/** The accent and tint a palette setting resolves to. */
export function resolvePalette({ palette, customAccent, customTint }) {
  if (palette === 'custom') return { accent: customAccent, tint: customTint || null }
  const preset = PALETTES.find((p) => p.id === palette)
  if (!preset || preset.id === 'system') return { accent: systemAccent, tint: null }
  return { accent: preset.accent, tint: preset.tint }
}

export function applyPalette(settings) {
  const { accent, tint } = resolvePalette(settings)
  const root = document.documentElement
  root.style.setProperty('--accent', accent || systemAccent || DEFAULT_ACCENT)
  if (tint) {
    root.style.setProperty('--tint', tint)
    root.dataset.tint = ''
  } else {
    root.style.removeProperty('--tint')
    delete root.dataset.tint
  }
}
