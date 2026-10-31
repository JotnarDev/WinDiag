// The technician's own drivers: a folder of .inf drivers (on a USB drive or a
// server share) or a catalog JSON describing one, which can also list BIOS
// updaters. Drivers install with pnputil; nothing leaves the network.
import { dialog } from 'electron'
import path from 'path'
import { existsSync } from 'fs'
import { readdir, readFile, stat, writeFile } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { parseInf } from '../inf-parser'
import {
  buildCatalog,
  catalogEntry,
  guessBiosEntry,
  isRetiredFolder,
  matchBios,
  parseCatalog
} from '../driver-catalog'

const execFileAsync = promisify(execFile)

const DEFAULT_FOLDER_NAME = '02 Drivers'
// Guards against pointing the scan at a whole drive by mistake
const MAX_DEPTH = 12
const MAX_INF_SIZE = 4 * 1024 * 1024
const PARSE_CONCURRENCY = 8
const MAX_CATALOG_SIZE = 32 * 1024 * 1024
const CATALOG_FILE_NAME = 'drivers-catalog.json'

// INFs parsed earlier, keyed by path and invalidated when the file changes,
// so a second comparison doesn't read every file again
const infCache = new Map()

export async function canOpen(target, isFile) {
  try {
    const info = await stat(target)
    return isFile ? info.isFile() : info.isDirectory()
  } catch {
    return false
  }
}

/** Looks for a "02 Drivers" folder at the root of every drive. */
export function findDefaultDriverFolder() {
  if (process.platform !== 'win32') return null
  for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZC') {
    const candidate = `${letter}:\\${DEFAULT_FOLDER_NAME}`
    if (existsSync(candidate)) return candidate
  }
  return null
}

// INFs, plus executables that could be BIOS updaters (for the catalog)
async function findDriverFiles(root) {
  const found = []
  const executables = []
  async function walk(dir, depth) {
    if (depth > MAX_DEPTH) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!isRetiredFolder(entry.name)) await walk(fullPath, depth + 1)
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase()
        if (name.endsWith('.inf')) found.push(fullPath)
        else if (/\.(exe|cmd|bat)$/.test(name)) executables.push(fullPath)
      }
    }
  }
  await walk(root, 0)
  return { infPaths: found, executables }
}

async function readInf(infPath) {
  try {
    const info = await stat(infPath)
    if (info.size > MAX_INF_SIZE) return null
    const key = `${info.size}:${info.mtimeMs}`
    const cached = infCache.get(infPath)
    if (cached?.key === key) return cached.inf
    const inf = parseInf(await readFile(infPath), process.arch)
    infCache.set(infPath, { key, inf })
    return inf
  } catch {
    return null
  }
}

async function readInfs(paths) {
  const results = new Array(paths.length)
  let next = 0
  async function worker() {
    while (next < paths.length) {
      const index = next++
      results[index] = await readInf(paths[index])
    }
  }
  await Promise.all(Array.from({ length: PARSE_CONCURRENCY }, worker))
  return results
}

// Every usable INF under `folder`, parsed
async function readFolderEntries(folder) {
  const { infPaths } = await findDriverFiles(folder)
  const infs = await readInfs(infPaths)
  const entries = []
  infs.forEach((inf, index) => {
    if (!inf) return
    entries.push({
      infPath: infPaths[index],
      relPath: path.relative(folder, infPaths[index]),
      version: inf.version,
      date: inf.date,
      provider: inf.provider,
      ids: inf.ids,
      inf
    })
  })
  return { entries, bios: [], infCount: infPaths.length }
}

async function readCatalogEntries(catalogPath) {
  const info = await stat(catalogPath)
  if (info.size > MAX_CATALOG_SIZE) throw new Error('The catalog file is too large.')
  const { entries, bios, total } = parseCatalog(
    await readFile(catalogPath, 'utf8'),
    catalogPath,
    process.arch
  )
  return { entries, bios, infCount: total }
}

export async function find({ request, inventory }) {
  const { kind, path: target } = request.local
  const isCatalog = kind === 'catalog'
  if (!(await canOpen(target, isCatalog))) {
    return {
      fatal: true,
      error: `"${target}" can't be opened. If it's on a server, check the network and use its \\\\server\\share path: drives mapped to a letter aren't visible to apps running as administrator.`
    }
  }
  const read = isCatalog ? await readCatalogEntries(target) : await readFolderEntries(target)
  const drivers = read.entries.map((entry) => ({
    key: `folder:${entry.infPath}`,
    hardwareIds: entry.ids,
    version: entry.version,
    date: entry.date,
    provider: entry.provider,
    label: entry.relPath,
    infPath: entry.infPath
  }))

  let bios = []
  let biosNote = null
  if (read.bios.length === 0) {
    biosNote = isCatalog
      ? 'The catalog lists no BIOS updates.'
      : 'BIOS updates from your own files need a driver catalog (add them to its "bios" list).'
  } else {
    const { system } = await inventory
    const match = system ? matchBios(read.bios, system) : null
    if (match) {
      bios = [
        {
          key: `folder:${match.path}`,
          version: match.version,
          date: match.date,
          label: match.relPath,
          notes: match.notes,
          path: match.path,
          arguments: match.arguments
        }
      ]
    } else {
      biosNote = 'The catalog has no BIOS update for this model.'
    }
  }
  return {
    drivers,
    bios,
    biosNote,
    summary: isCatalog
      ? `${read.entries.length} of ${read.infCount} catalog entries are usable`
      : `${read.entries.length} of ${read.infCount} INF files apply to this system`
  }
}

/**
 * Adds each INF to the driver store and installs it on matching devices
 * (pnputil /add-driver /install), one after the other.
 */
export async function install(candidates) {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  const results = {}
  for (const candidate of candidates) {
    const { infPath } = candidate
    if (!(await canOpen(infPath, true))) {
      results[candidate.key] = {
        success: false,
        message: `The driver file can't be reached: ${infPath}. Check that the folder or server is available.`
      }
      continue
    }
    let exitCode = 0
    let output = ''
    try {
      const result = await execFileAsync(
        path.join(systemRoot, 'System32', 'pnputil.exe'),
        ['/add-driver', infPath, '/install'],
        { windowsHide: true, timeout: 5 * 60e3 }
      )
      output = result.stdout
    } catch (err) {
      exitCode = typeof err.code === 'number' ? err.code : -1
      output = err.stdout || err.message || ''
    }
    // 3010: installed, restart needed. 259: added, but no device took it.
    if (exitCode !== 0 && exitCode !== 3010 && exitCode !== 259) {
      const lastLine = output.trim().split(/\r?\n/).filter(Boolean).pop()
      results[candidate.key] = {
        success: false,
        message: `pnputil couldn’t install the driver (code ${exitCode})${lastLine ? `: ${lastLine}` : '.'}`
      }
      continue
    }
    results[candidate.key] = {
      success: true,
      rebootRequired: exitCode === 3010,
      notApplied: exitCode === 259
    }
  }
  return results
}

/** The BIOS updater from the catalog, if it can still be reached. */
export async function prepareBios(candidate) {
  if (!(await canOpen(candidate.path, true))) {
    throw new Error(
      `The BIOS updater can't be reached: ${candidate.path}. Check that the folder or server is available.`
    )
  }
  return { file: candidate.path, args: candidate.arguments }
}

/**
 * Builds a catalog from every INF under `folder` and saves it where the
 * technician chooses (by default inside the folder, so "root" can stay empty).
 */
export async function createCatalog(win, folder) {
  if (!(await canOpen(folder, false))) {
    return { success: false, message: `The folder "${folder}" can't be opened.` }
  }
  const result = await dialog.showSaveDialog(win, {
    title: 'Save the driver catalog',
    defaultPath: path.join(folder, CATALOG_FILE_NAME),
    filters: [{ name: 'Driver catalog', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { success: false, canceled: true }
  const [{ entries }, { executables }] = await Promise.all([
    readFolderEntries(folder),
    findDriverFiles(folder)
  ])
  // BIOS entries are checked by hand, so the ones already in the file are
  // kept and only updaters it doesn't list yet are added
  let keptBios = []
  try {
    const previous = JSON.parse((await readFile(result.filePath, 'utf8')).replace(/^\uFEFF/, ''))
    if (Array.isArray(previous.bios)) keptBios = previous.bios
  } catch {
    // no previous catalog there
  }
  const listed = new Set(keptBios.map((entry) => String(entry?.path ?? '').toLowerCase()))
  const newBios = executables
    .map((file) => guessBiosEntry(path.relative(folder, file)))
    .filter((entry) => entry && !listed.has(entry.path.toLowerCase()))
  const savedInFolder = path.dirname(result.filePath) === path.resolve(folder)
  const catalog = buildCatalog(
    entries.map((entry) => catalogEntry(entry.relPath, entry.inf)),
    { root: savedInFolder ? '' : folder, arch: process.arch, bios: [...keptBios, ...newBios] }
  )
  try {
    await writeFile(result.filePath, JSON.stringify(catalog, null, 2))
  } catch (err) {
    return { success: false, message: `Couldn't save the catalog: ${err.message}` }
  }
  return {
    success: true,
    path: result.filePath,
    count: catalog.drivers.length,
    biosCount: catalog.bios.length
  }
}
