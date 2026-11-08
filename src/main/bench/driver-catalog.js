// The driver catalog: a JSON list of the drivers in a driver folder, so the
// comparison reads one small file instead of every INF (useful when the
// folder is on a server). No Electron APIs, so it can be built anywhere.
import path from 'path'

export const CATALOG_FORMAT = 1

const ABOUT =
  'WinDiag driver catalog. "root" is the driver folder (leave it empty to use the folder this file is in). ' +
  'Each entry in "drivers" is one .inf: "path" is relative to root, "version"/"date" come from its DriverVer, ' +
  'and "hardwareIds" are the devices it installs on. Add or remove entries freely; ' +
  'entries without path, version or hardwareIds are ignored. ' +
  '"bios" lists BIOS updaters: "model" is matched against the start of the Windows model name ' +
  '(e.g. "CF-33" matches "CF-33LEHAZT3"), "sku" (optional) must appear in the system SKU, ' +
  '"version" is the BIOS version the updater installs, "installedPrefix" (optional) is how the ' +
  'installed BIOS version must start for the update to be offered (Panasonic: "V1." = MK1, "V2." = MK2), ' +
  '"path" is the updater (.exe, .cmd or .bat) ' +
  'and "arguments" (optional) are passed to it. Entries with an empty version are ignored: ' +
  'check each one before using the catalog.'

// Folders the technician has retired ("EM7455Build4799 - OLD")
export const isRetiredFolder = (name) => /-\s*old$/i.test(name.trim())

/** One catalog entry from a parsed INF (see inf-parser) and its path relative to the root. */
export function catalogEntry(relPath, inf) {
  return {
    path: relPath.split(/[\\/]/).join('\\'),
    description: inf.description ?? null,
    provider: inf.provider ?? null,
    class: inf.driverClass ?? null,
    version: inf.version,
    date: inf.date,
    hardwareIds: inf.ids
  }
}

// Panasonic writes "V100L31" in file names; Windows reports "V1.00L31"
const PANASONIC_VERSION = /^V(\d+?)\.?(\d{2})L(\d+)$/i

/** "V100L31" → "V1.00L31"; other versions are returned trimmed. */
export function normalizeBiosVersion(version) {
  const text = String(version ?? '').trim()
  const panasonic = PANASONIC_VERSION.exec(text)
  return panasonic ? `V${Number(panasonic[1])}.${panasonic[2]}L${panasonic[3]}` : text
}

// "V2.00L10" → [2, 0, 10]; "1.28.1" → [1, 28, 1]
function biosVersionParts(version) {
  return normalizeBiosVersion(version).match(/\d+/g)?.map(Number) ?? null
}

/** <0 if BIOS version a is older than b, 0 if equal, >0 if newer; null if not comparable. */
export function compareBiosVersions(a, b) {
  const va = biosVersionParts(a)
  const vb = biosVersionParts(b)
  if (!va || !vb) return null
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const diff = (va[i] ?? 0) - (vb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// "FZ-55" must match "FZ55-1": only letters and digits count
const normalizeModel = (value) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

/** The newest BIOS entry for this system ({ manufacturer, model, sku }), or null. */
export function matchBios(entries, system) {
  const model = normalizeModel(system.model)
  const manufacturer = String(system.manufacturer ?? '').toUpperCase()
  const sku = normalizeModel(system.sku)
  const installed = normalizeBiosVersion(system.version).toUpperCase()
  // Panasonic's model ends in the generation ("FZ55-1" = MK1)
  const generation = /panasonic/i.test(system.manufacturer ?? '')
    ? /-(\d)$/.exec(String(system.model ?? '').trim())?.[1]
    : undefined
  let best = null
  for (const entry of entries) {
    if (!model.startsWith(normalizeModel(entry.model))) continue
    if (entry.manufacturer && !manufacturer.includes(entry.manufacturer.toUpperCase())) continue
    if (entry.sku && !sku.includes(normalizeModel(entry.sku))) continue
    // A BIOS for another generation of the same model must never be offered
    if (entry.installedPrefix && !installed.startsWith(entry.installedPrefix.toUpperCase()))
      continue
    // …and the model's generation must agree with the BIOS line ("V1." = MK1)
    const entryGeneration = /^V(\d+)\./i.exec(entry.installedPrefix ?? '')?.[1]
    if (generation && entryGeneration && generation !== entryGeneration) continue
    if (!best || compareBiosVersions(entry.version, best.version) > 0) best = entry
  }
  return best
}

const BIOS_FOLDER = /bios/i
const UPDATER_EXTENSIONS = /\.(exe|cmd|bat)$/i

/**
 * A BIOS entry guessed from an updater's path ("Panasonic\CF-33\CF-33 MK1
 * BIOS Update\xyz.exe"), or null if it isn't in a BIOS folder. The version is
 * only filled when the file name carries one; the rest is for a person to check.
 */
export function guessBiosEntry(relPath) {
  const parts = relPath.split(/[\\/]/)
  const fileName = parts[parts.length - 1]
  if (!UPDATER_EXTENSIONS.test(fileName)) return null
  if (isRetiredFolder(fileName.replace(UPDATER_EXTENSIONS, ''))) return null
  if (!parts.slice(0, -1).some((part) => BIOS_FOLDER.test(part)) && !BIOS_FOLDER.test(fileName)) {
    return null
  }
  const modelFolder = parts.length > 2 ? parts[1] : ''
  const model = /^[A-Z]{1,3}-?[A-Z]?\d+[A-Z]?/i.exec(modelFolder)?.[0] ?? modelFolder
  const panasonic = /V\d+\.?\d{2}L\d+/i.exec(fileName)?.[0]
  const version = panasonic
    ? normalizeBiosVersion(panasonic)
    : (/\d+\.\d+\.\d+(\.\d+)?/.exec(fileName)?.[0] ?? '')
  // Panasonic's major version is the generation (V1 = MK1, V2 = MK2…)
  const installedPrefix = panasonic ? version.slice(0, version.indexOf('.') + 1) : ''
  return {
    manufacturer: parts.length > 1 ? parts[0] : '',
    model,
    sku: '',
    version,
    installedPrefix,
    path: parts.join('\\'),
    arguments: '',
    notes: 'Generated from the folder name: check model and version.'
  }
}

export function buildCatalog(entries, { root = '', arch = 'x64', bios = [] } = {}) {
  return {
    about: ABOUT,
    format: CATALOG_FORMAT,
    arch,
    root,
    generated: new Date().toISOString().slice(0, 10),
    bios,
    drivers: [...entries].sort((a, b) => a.path.localeCompare(b.path))
  }
}

/**
 * Reads a catalog's text. Returns the root folder and the usable entries,
 * with absolute INF paths; throws an Error with a readable message.
 */
export function parseCatalog(text, catalogPath, arch = 'x64') {
  let catalog
  try {
    catalog = JSON.parse(text.replace(/^﻿/, ''))
  } catch (err) {
    throw new Error(`The catalog isn't valid JSON: ${err.message}`)
  }
  if (!catalog || !Array.isArray(catalog.drivers)) {
    throw new Error('The catalog has no "drivers" list.')
  }
  if (catalog.arch && catalog.arch !== arch) {
    throw new Error(`The catalog lists ${catalog.arch} drivers, but this system is ${arch}.`)
  }
  const root =
    typeof catalog.root === 'string' && catalog.root.trim()
      ? catalog.root.trim()
      : path.dirname(catalogPath)
  const entries = []
  for (const driver of catalog.drivers) {
    if (!driver || typeof driver.path !== 'string' || typeof driver.version !== 'string') continue
    if (!Array.isArray(driver.hardwareIds) || driver.hardwareIds.length === 0) continue
    const relPath = driver.path.trim()
    entries.push({
      infPath: path.resolve(root, relPath),
      relPath,
      version: driver.version.trim(),
      date: typeof driver.date === 'string' ? driver.date : null,
      provider: typeof driver.provider === 'string' ? driver.provider : null,
      ids: driver.hardwareIds.filter((id) => typeof id === 'string').map((id) => id.toUpperCase())
    })
  }
  const bios = []
  for (const entry of Array.isArray(catalog.bios) ? catalog.bios : []) {
    const text = (key) => (typeof entry?.[key] === 'string' ? entry[key].trim() : '')
    if (!text('model') || !text('version') || !text('path')) continue
    bios.push({
      manufacturer: text('manufacturer'),
      model: text('model'),
      sku: text('sku'),
      version: normalizeBiosVersion(text('version')),
      installedPrefix: text('installedPrefix'),
      date: text('date') || null,
      relPath: text('path'),
      path: path.resolve(root, text('path')),
      arguments: text('arguments'),
      notes: text('notes') || null
    })
  }
  return { root, entries, bios, total: catalog.drivers.length }
}
