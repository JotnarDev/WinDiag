import { app } from 'electron'
import path from 'path'
import { readFileSync, writeFileSync } from 'fs'

// Pages that can be chosen as the start page (the navigation ids)
const PAGE_IDS = [
  'overview',
  'display',
  'touch',
  'keyboard',
  'audio',
  'battery',
  'disk',
  'ports',
  'otherDevices',
  'tools',
  'drivers',
  'users'
]

// Each setting: its default and whether a value from disk/the page is valid
const SCHEMA = {
  theme: { default: 'system', valid: (v) => ['system', 'light', 'dark'].includes(v) },
  transparency: { default: true, valid: (v) => typeof v === 'boolean' },
  startPage: { default: 'overview', valid: (v) => PAGE_IDS.includes(v) },
  blockSystemKeys: { default: true, valid: (v) => typeof v === 'boolean' },
  // Last folder compared on the Drivers page ('' = look for "02 Drivers")
  driversFolder: { default: '', valid: (v) => typeof v === 'string' && v.length < 1024 },
  // Driver catalog JSON to compare with instead of reading the folder ('' = none)
  palette: {
    default: 'system',
    valid: (v) => ['system', 'ocean', 'forest', 'sunset', 'grape', 'slate', 'custom'].includes(v)
  },
  customAccent: { default: '#0078d4', valid: (v) => /^#[0-9a-f]{6}$/i.test(v) },
  // '' = no background tint
  customTint: { default: '', valid: (v) => v === '' || /^#[0-9a-f]{6}$/i.test(v) },
  driverCatalog: { default: '', valid: (v) => typeof v === 'string' && v.length < 1024 },
  // Driver sources compared on the Drivers page
  driversWindowsUpdate: { default: true, valid: (v) => typeof v === 'boolean' },
  driversUseFolder: { default: true, valid: (v) => typeof v === 'boolean' }
}

const DEFAULTS = Object.fromEntries(Object.entries(SCHEMA).map(([key, s]) => [key, s.default]))

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')

let current = null

/** Only known keys with valid values survive; anything else is dropped. */
function sanitize(values) {
  const clean = {}
  for (const [key, value] of Object.entries(values ?? {})) {
    if (SCHEMA[key]?.valid(value)) clean[key] = value
  }
  return clean
}

export function getSettings() {
  if (!current) {
    let stored = {}
    try {
      stored = JSON.parse(readFileSync(settingsFile(), 'utf8'))
    } catch {
      // first run or unreadable file: defaults
    }
    current = { ...DEFAULTS, ...sanitize(stored) }
  }
  return current
}

function save() {
  try {
    writeFileSync(settingsFile(), JSON.stringify(current, null, 2))
  } catch {
    // read-only location: the change still applies for this session
  }
}

export function updateSettings(patch) {
  current = { ...getSettings(), ...sanitize(patch) }
  save()
  return current
}

export function resetSettings() {
  current = { ...DEFAULTS }
  save()
  return current
}
