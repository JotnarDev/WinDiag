// The Drivers page's engine: reads the computer once, asks every driver
// source that applies (see driver-sources), offers the newest driver for each
// device and the newest BIOS, and installs through the source that offered it.
// Nothing here knows about a particular source.
import { dialog } from 'electron'
import path from 'path'
import { spawn } from 'child_process'
import si from 'systeminformation'
import { compareVersions } from './inf-parser'
import { compareBiosVersions } from './driver-catalog'
import { friendlyModel } from './device-model'
import { runPowerShell } from './powershell'
import { isRunningElevated, notElevatedResult } from './system-tools'
import { activeSources, getSource } from './driver-sources'

// The folder source's own tools, loaded like the source itself
export async function findDefaultDriverFolder() {
  return (await import('./driver-sources/local')).findDefaultDriverFolder()
}

export async function createCatalog(win, folder) {
  return (await import('./driver-sources/local')).createCatalog(win, folder)
}

// What the last comparison offered, by key: the only things that can be
// installed. Each entry is { sourceId, candidate }.
let offeredDrivers = new Map()
let offeredBios = new Map()

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

async function readInventory() {
  try {
    const parsed = JSON.parse(await runPowerShell(DEVICES_SCRIPT, 90e3))
    return {
      devices: Array.isArray(parsed.devices) ? parsed.devices : [],
      system: parsed.system ?? null
    }
  } catch {
    return { devices: [], system: null }
  }
}

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

// A trusted source (Windows Update) only offers a driver it ranks above the
// installed one, so when neither version nor date can be compared its word
// is taken for it
function offersUpdate(candidate, installed) {
  if (isNewer(candidate, installed)) return true
  return (
    candidate.trusted === true &&
    compareVersions(candidate.version, installed.version) === null &&
    !(candidate.date && installed.date)
  )
}

const errorText = (err) => (err instanceof Error ? err.message : String(err))

/**
 * Compares the installed drivers with every source the request turns on:
 * { windowsUpdate: boolean, local: { kind: 'folder' | 'catalog', path } | null }.
 * Returns one row per device with a driver on offer (the newest wins), the
 * devices with no driver and none on offer, and the newest BIOS.
 */
export async function scanDrivers(request) {
  if (process.platform !== 'win32') return { supported: false }
  const inventory = readInventory()
  let sources
  try {
    sources = await activeSources(request, inventory)
  } catch (err) {
    return { supported: true, error: errorText(err) }
  }
  const found = await Promise.all(
    sources.map((source) =>
      source.module
        .find({ request, inventory })
        .catch((err) => ({ error: errorText(err) }))
        .then((result) => ({ source, result }))
    )
  )
  const fatal = found.find(({ result }) => result.fatal)
  if (fatal) return { supported: true, error: fatal.result.error }
  const { devices, system } = await inventory

  // Hardware ID → the drivers for it, from every source
  const byId = new Map()
  const biosCandidates = []
  offeredDrivers = new Map()
  offeredBios = new Map()
  for (const { source, result } of found) {
    for (const driver of result.drivers ?? []) {
      const candidate = { ...driver, source: source.id, sourceName: source.name }
      offeredDrivers.set(candidate.key, { sourceId: source.id, candidate })
      for (const id of driver.hardwareIds ?? []) {
        const upper = String(id).toUpperCase()
        if (!byId.has(upper)) byId.set(upper, [])
        byId.get(upper).push(candidate)
      }
    }
    for (const bios of result.bios ?? []) {
      biosCandidates.push({ ...bios, source: source.id, sourceName: source.name })
    }
  }

  const rows = []
  const unavailable = []
  for (const device of devices) {
    const hardwareIds = (device.hw ?? []).map((id) => String(id).toUpperCase())
    const compatibleIds = (device.compat ?? []).map((id) => String(id).toUpperCase())
    const hasDriver = Boolean(device.ver) && device.error !== CM_PROB_FAILED_INSTALL
    // A generic compatible-ID match (e.g. a USB class) is only offered to
    // devices that have no driver at all
    const idsToMatch = hasDriver ? hardwareIds : [...hardwareIds, ...compatibleIds]
    const candidates = idsToMatch.flatMap((id) => byId.get(id) ?? [])
    if (candidates.length === 0) {
      if (!hasDriver) {
        unavailable.push({
          deviceId: device.id,
          name: device.name ?? device.id,
          deviceClass: device.cls ?? null,
          hardwareId: hardwareIds[0] ?? null
        })
      }
      continue
    }
    const candidate = pickNewest(candidates)
    const installed = { version: device.ver ?? null, date: device.date ?? null }
    rows.push({
      deviceId: device.id,
      name: device.name ?? device.id,
      deviceClass: device.cls ?? null,
      installed: { ...installed, provider: device.prov ?? null, inf: device.inf ?? null },
      candidate,
      status: !hasDriver ? 'missing' : offersUpdate(candidate, installed) ? 'outdated' : 'current'
    })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  unavailable.sort((a, b) => a.name.localeCompare(b.name))

  const biosCandidate = biosCandidates.reduce(
    (best, c) => (!best || compareBiosVersions(c.version, best.version) > 0 ? c : best),
    null
  )
  const biosNewer =
    biosCandidate && system && compareBiosVersions(biosCandidate.version, system.version) > 0
  if (biosNewer)
    offeredBios.set(biosCandidate.key, { sourceId: biosCandidate.source, candidate: biosCandidate })

  return {
    supported: true,
    sources: found.map(({ source, result }) => ({
      id: source.id,
      name: source.name,
      ok: !result.error,
      error: result.error ?? null,
      summary: result.summary ?? null
    })),
    deviceCount: devices.length,
    devicesRead: devices.length > 0,
    rows,
    unavailable,
    bios: {
      system: system && {
        ...system,
        displayModel: friendlyModel(system.manufacturer, system.model)
      },
      candidate: biosCandidate,
      status: !biosCandidate ? 'none' : biosNewer ? 'outdated' : 'current',
      notes: found.map(({ result }) => result.biosNote).filter(Boolean)
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
 * Installs drivers the last comparison offered. `items` is
 * [{ key, deviceIds }]; each source installs its own in one go. Returns
 * { results: { [key]: { success, message, rebootRequired, notApplied, newVersions } } },
 * where newVersions says which driver version each device ended up with.
 */
export async function installDrivers(items) {
  const wanted = (Array.isArray(items) ? items : []).filter((item) => typeof item?.key === 'string')
  const results = {}
  const fail = (keys, message) => {
    for (const key of keys) results[key] = { success: false, message }
  }
  const offered = wanted.filter((item) => offeredDrivers.has(item.key))
  fail(
    wanted.filter((item) => !offeredDrivers.has(item.key)).map((item) => item.key),
    'That driver isn’t part of the last comparison. Compare again.'
  )
  if (offered.length === 0) return { results }
  if (!(await isRunningElevated())) {
    fail(
      offered.map((item) => item.key),
      notElevatedResult('install drivers').message
    )
    return { results }
  }

  const bySource = new Map()
  for (const item of offered) {
    const { sourceId, candidate } = offeredDrivers.get(item.key)
    if (!bySource.has(sourceId)) bySource.set(sourceId, [])
    bySource.get(sourceId).push(candidate)
  }
  for (const [sourceId, candidates] of bySource) {
    try {
      const module = await getSource(sourceId).load()
      Object.assign(results, await module.install(candidates))
    } catch (err) {
      fail(
        candidates.map((c) => c.key),
        errorText(err)
      )
    }
  }

  for (const item of offered) {
    const result = results[item.key]
    if (!result) continue
    result.newVersions = {}
    if (!result.success) continue
    const deviceIds = Array.isArray(item.deviceIds)
      ? item.deviceIds.filter((id) => typeof id === 'string')
      : []
    for (const deviceId of deviceIds) {
      result.newVersions[deviceId] = await readInstalledVersion(deviceId)
    }
  }
  return { results }
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
 * Starts the BIOS updater the last comparison offered. The updater shows its
 * own window and restarts the device itself; WinDiag checks the power source
 * and suspends BitLocker for one restart so it doesn't ask for the recovery
 * key after the flash. The source provides the updater (and may download it).
 */
export async function launchBiosUpdate(key) {
  const offered = offeredBios.get(key)
  if (!offered) {
    return {
      success: false,
      message: 'That BIOS update isn’t part of the last comparison. Compare again.'
    }
  }
  if (!(await isRunningElevated())) return notElevatedResult('update the BIOS')
  const battery = await si.battery().catch(() => null)
  if (battery?.hasBattery && !battery.acConnected) {
    return {
      success: false,
      message: 'Connect the AC adapter first. A BIOS update must never run on battery alone.'
    }
  }
  let updater
  try {
    const module = await getSource(offered.sourceId).load()
    updater = await module.prepareBios(offered.candidate)
  } catch (err) {
    return { success: false, message: errorText(err) }
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
  const { file, args } = updater
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
