import { dialog } from 'electron'
import path from 'path'
import { existsSync } from 'fs'
import { readdir, readFile, stat, writeFile } from 'fs/promises'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { compareVersions, parseInf } from './inf-parser'
import si from 'systeminformation'
import {
  buildCatalog,
  catalogEntry,
  compareBiosVersions,
  guessBiosEntry,
  isRetiredFolder,
  matchBios,
  parseCatalog
} from './driver-catalog'
import { friendlyModel } from './device-model'
import { runPowerShell } from './powershell'
import { isRunningElevated, notElevatedResult } from './system-tools'

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
// Only INFs found by the last scan can be installed
let scannedInfPaths = new Set()
// …and only the BIOS updater the last scan offered for this device
let offeredBiosUpdate = null

/** Looks for a "02 Drivers" folder at the root of every drive. */
export function findDefaultDriverFolder() {
  if (process.platform !== 'win32') return null
  for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZC') {
    const candidate = `${letter}:\\${DEFAULT_FOLDER_NAME}`
    if (existsSync(candidate)) return candidate
  }
  return null
}

export async function chooseDriverFolder(win, defaultPath) {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose the driver folder',
    defaultPath: defaultPath || undefined,
    properties: ['openDirectory']
  })
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

export async function chooseCatalogFile(win, defaultPath) {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose the driver catalog',
    defaultPath: defaultPath || undefined,
    filters: [{ name: 'Driver catalog', extensions: ['json'] }],
    properties: ['openFile']
  })
  return result.canceled ? null : (result.filePaths[0] ?? null)
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

// Every present device with its hardware/compatible IDs and current driver,
// and the model and BIOS (to match BIOS updates)
const DEVICES_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
    $drivers = @{}
    Get-CimInstance Win32_PnPSignedDriver -Property DeviceID, DriverVersion, DriverDate, InfName, DriverProviderName |
        ForEach-Object { if ($_.DeviceID) { $drivers[$_.DeviceID] = $_ } }
    $devices = Get-CimInstance Win32_PnPEntity -Property DeviceID, Name, HardwareID, CompatibleID, ConfigManagerErrorCode, PNPClass |
        Where-Object { $_.HardwareID } |
        ForEach-Object {
            $d = $drivers[$_.DeviceID]
            [PSCustomObject]@{
                id     = $_.DeviceID
                name   = $_.Name
                cls    = $_.PNPClass
                error  = [int]$_.ConfigManagerErrorCode
                hw     = @($_.HardwareID)
                compat = @($_.CompatibleID)
                ver    = if ($d) { $d.DriverVersion } else { $null }
                date   = if ($d -and $d.DriverDate) { $d.DriverDate.ToString('yyyy-MM-dd') } else { $null }
                inf    = if ($d) { $d.InfName } else { $null }
                prov   = if ($d) { $d.DriverProviderName } else { $null }
            }
        }
    $cs = Get-CimInstance Win32_ComputerSystem -Property Manufacturer, Model, SystemSKUNumber
    $bios = Get-CimInstance Win32_BIOS -Property SMBIOSBIOSVersion, ReleaseDate
    $system = [PSCustomObject]@{
        manufacturer = $cs.Manufacturer
        model        = $cs.Model
        sku          = $cs.SystemSKUNumber
        version      = $bios.SMBIOSBIOSVersion
        date         = if ($bios.ReleaseDate) { $bios.ReleaseDate.ToString('yyyy-MM-dd') } else { $null }
    }
    ConvertTo-Json -InputObject ([PSCustomObject]@{ devices = @($devices); system = $system }) -Compress -Depth 4
} catch { '' }
`.trim()

// Code 28: the device has no driver installed
const CM_PROB_FAILED_INSTALL = 28

function isNewer(candidate, installed) {
  const byVersion = compareVersions(candidate.version, installed.version)
  if (byVersion !== null && byVersion !== 0) return byVersion > 0
  if (byVersion === 0) return false
  return Boolean(candidate.date && installed.date && candidate.date > installed.date)
}

function pickNewest(candidates) {
  return candidates.reduce((best, c) => (!best || isNewer(c, best) ? c : best), null)
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

async function canOpen(target, isFile) {
  try {
    const info = await stat(target)
    return isFile ? info.isFile() : info.isDirectory()
  } catch {
    return false
  }
}

/**
 * Compares the installed drivers with a driver folder ({ kind: 'folder' })
 * or a catalog JSON ({ kind: 'catalog' }). Returns one row per device that
 * has a matching driver.
 */
export async function scanDrivers(source) {
  if (process.platform !== 'win32') return { supported: false }
  const isCatalog = source.kind === 'catalog'
  if (!(await canOpen(source.path, isCatalog))) {
    return {
      supported: true,
      error: `"${source.path}" can't be opened. If it's on a server, check the network and use its \\\\server\\share path: drives mapped to a letter aren't visible to apps running as administrator.`
    }
  }
  let read
  let devicesOutput
  try {
    ;[read, devicesOutput] = await Promise.all([
      isCatalog ? readCatalogEntries(source.path) : readFolderEntries(source.path),
      runPowerShell(DEVICES_SCRIPT, 90e3).catch(() => '')
    ])
  } catch (err) {
    return { supported: true, error: err instanceof Error ? err.message : String(err) }
  }

  // Hardware ID → the drivers for it
  const byId = new Map()
  for (const { inf: _inf, ids, ...entry } of read.entries) {
    for (const id of ids) {
      if (!byId.has(id)) byId.set(id, [])
      byId.get(id).push(entry)
    }
  }
  scannedInfPaths = new Set(read.entries.map((entry) => entry.infPath))

  let devices = []
  let system = null
  try {
    const parsed = JSON.parse(devicesOutput)
    devices = Array.isArray(parsed.devices) ? parsed.devices : []
    system = parsed.system ?? null
  } catch {
    // reported below as devicesRead: false
  }
  const rows = []
  for (const device of devices) {
    const hardwareIds = (device.hw ?? []).map((id) => String(id).toUpperCase())
    const compatibleIds = (device.compat ?? []).map((id) => String(id).toUpperCase())
    const hasDriver = Boolean(device.ver) && device.error !== CM_PROB_FAILED_INSTALL
    // A generic compatible-ID match (e.g. a USB class) is only offered to
    // devices that have no driver at all
    const idsToMatch = hasDriver ? hardwareIds : [...hardwareIds, ...compatibleIds]
    const candidates = idsToMatch.flatMap((id) => byId.get(id) ?? [])
    if (candidates.length === 0) continue
    const candidate = pickNewest(candidates)
    const installed = { version: device.ver ?? null, date: device.date ?? null }
    rows.push({
      deviceId: device.id,
      name: device.name ?? device.id,
      deviceClass: device.cls ?? null,
      installed: { ...installed, provider: device.prov ?? null, inf: device.inf ?? null },
      candidate,
      status: !hasDriver ? 'missing' : isNewer(candidate, installed) ? 'outdated' : 'current'
    })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))

  const biosCandidate = system && read.bios.length > 0 ? matchBios(read.bios, system) : null
  const biosNewer = biosCandidate && compareBiosVersions(biosCandidate.version, system.version) > 0
  offeredBiosUpdate = biosNewer ? biosCandidate : null
  return {
    supported: true,
    source,
    infCount: read.infCount,
    usableInfCount: read.entries.length,
    deviceCount: devices.length,
    devicesRead: devices.length > 0,
    rows,
    bios: {
      // BIOS updates come only from a catalog
      catalogHasBios: read.bios.length > 0,
      system: system && {
        ...system,
        displayModel: friendlyModel(system.manufacturer, system.model)
      },
      candidate: biosCandidate,
      status: !biosCandidate ? 'none' : biosNewer ? 'outdated' : 'current'
    }
  }
}

const escapePs = (value) => value.replace(/'/g, "''")

async function readInstalledVersion(deviceId) {
  const output = await runPowerShell(
    `try { (Get-CimInstance Win32_PnPSignedDriver -Property DeviceID, DriverVersion | Where-Object DeviceID -eq '${escapePs(deviceId)}' | Select-Object -First 1).DriverVersion } catch { '' }`,
    30e3
  ).catch(() => '')
  return output.trim() || null
}

/**
 * Adds the INF to the driver store and installs it on matching devices
 * (pnputil /add-driver /install), then checks what the device ended up with.
 */
export async function installDriver(infPath, deviceId) {
  if (!scannedInfPaths.has(infPath)) {
    return { success: false, message: 'That driver isn’t part of the last scan. Compare again.' }
  }
  if (!(await isRunningElevated())) return notElevatedResult('install drivers')
  if (!(await canOpen(infPath, true))) {
    return {
      success: false,
      message: `The driver file can't be reached: ${infPath}. Check that the folder or server is available.`
    }
  }
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
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
  const rebootRequired = exitCode === 3010
  if (exitCode !== 0 && exitCode !== 3010 && exitCode !== 259) {
    const lastLine = output.trim().split(/\r?\n/).filter(Boolean).pop()
    return {
      success: false,
      message: `pnputil couldn’t install the driver (code ${exitCode})${lastLine ? `: ${lastLine}` : '.'}`
    }
  }
  const newVersion = deviceId ? await readInstalledVersion(deviceId) : null
  return { success: true, rebootRequired, notApplied: exitCode === 259, newVersion }
}

// Suspends BitLocker on the system drive for one restart, if it's on
const SUSPEND_BITLOCKER_SCRIPT = `
try {
    $volume = Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop
    if ($volume.ProtectionStatus -eq 'On') {
        Suspend-BitLocker -MountPoint $env:SystemDrive -RebootCount 1 -ErrorAction Stop | Out-Null
        'suspended'
    } else { 'off' }
} catch { 'error' }
`.trim()

/**
 * Starts the BIOS updater the last scan offered. The updater shows its own
 * window and restarts the device itself; WinDiag only checks the power
 * source and suspends BitLocker for one restart so it doesn't ask for the
 * recovery key after the flash.
 */
export async function launchBiosUpdate(updaterPath) {
  if (!offeredBiosUpdate || offeredBiosUpdate.path !== updaterPath) {
    return {
      success: false,
      message: 'That BIOS update isn’t part of the last scan. Compare again.'
    }
  }
  if (!(await isRunningElevated())) return notElevatedResult('update the BIOS')
  if (!(await canOpen(updaterPath, true))) {
    return {
      success: false,
      message: `The BIOS updater can't be reached: ${updaterPath}. Check that the folder or server is available.`
    }
  }
  const battery = await si.battery().catch(() => null)
  if (battery?.hasBattery && !battery.acConnected) {
    return {
      success: false,
      message: 'Connect the AC adapter first. A BIOS update must never run on battery alone.'
    }
  }
  const bitlocker = (
    await runPowerShell(SUSPEND_BITLOCKER_SCRIPT, 60e3).catch(() => 'error')
  ).trim()
  if (bitlocker === 'error') {
    // Not every edition has the BitLocker module; only stop when it's known to be on
    const status = await runPowerShell(
      "try { (New-Object -ComObject Shell.Application).NameSpace($env:SystemDrive).Self.ExtendedProperty('System.Volume.BitLockerProtection') } catch { '' }",
      15e3
    ).catch(() => '')
    if (status.trim() === '1') {
      return {
        success: false,
        message:
          'BitLocker is on and couldn’t be suspended. Suspend it in Control Panel → BitLocker before updating the BIOS.'
      }
    }
  }
  const { arguments: args, path: file } = offeredBiosUpdate
  const isScript = /\.(cmd|bat)$/i.test(file)
  try {
    await new Promise((resolve, reject) => {
      const child = isScript
        ? spawn(
            process.env.ComSpec || 'cmd.exe',
            ['/d', '/s', '/c', `""${file}"${args ? ` ${args}` : ''}"`],
            {
              cwd: path.dirname(file),
              detached: true,
              stdio: 'ignore',
              windowsVerbatimArguments: true
            }
          )
        : spawn(file, args ? args.match(/"[^"]*"|\S+/g).map((a) => a.replace(/^"|"$/g, '')) : [], {
            cwd: path.dirname(file),
            detached: true,
            stdio: 'ignore'
          })
      child.once('error', reject)
      child.once('spawn', () => {
        child.unref()
        resolve()
      })
    })
  } catch (err) {
    return { success: false, message: `The BIOS updater couldn't start: ${err.message}` }
  }
  return { success: true, bitlockerSuspended: bitlocker === 'suspended' }
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
