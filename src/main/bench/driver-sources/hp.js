// HP's own catalog: the reference files HP Image Assistant reads, public on
// hpia.hpcloud.hp.com. Only loaded on HP computers (see index.js).
//
// 1. platformList.cab lists every HP platform by its SystemID, which Windows
//    reports as the baseboard product ("880D"), and the Windows versions HP
//    supports on it.
// 2. The platform's reference file for this Windows
//    (880d_64_11.0.24h2.cab) lists the SoftPaqs for it and, for each device
//    HP knows, its exact hardware ID, the driver version HP ships for it and
//    the SoftPaq that installs it.
// 3. A SoftPaq is a self-extracting .exe: drivers are extracted and installed
//    silently with the command HP gives; the BIOS runs with its own window.
//
// Every SoftPaq is checked against the reference's SHA-256 and HP's digital
// signature before it runs.
import path from 'path'
import { mkdir, rm } from 'fs/promises'
import {
  CATALOG_MAX_AGE_MS,
  cacheDir,
  checkSignature,
  devicesNamed,
  download,
  errorMessage,
  isFresh,
  pruneOld,
  readCab,
  run,
  runCommandLine,
  xmlAttribute,
  xmlText,
  xmlTexts
} from './maker-files'

const MAKER = 'HP'
const REF_URL = 'https://hpia.hpcloud.hp.com/ref/'
const CACHE_DIR = cacheDir('hp')
const PACKAGES_DIR = path.join(CACHE_DIR, 'packages')
const EXTRACT_TIMEOUT_MS = 10 * 60e3
const INSTALL_TIMEOUT_MS = 30 * 60e3
const FIRST_WINDOWS_11_BUILD = 22000

// ---------- Platform list ----------

/** The platform's Windows versions: [{ build, release, windows11 }]. */
export function findPlatform(xml, board) {
  const id = String(board ?? '')
    .trim()
    .toUpperCase()
  if (!/^[0-9A-F]{4}$/.test(id)) return null
  for (const block of xml.split('<Platform ').slice(1)) {
    if (String(xmlText(block, 'SystemID') ?? '').toUpperCase() !== id) continue
    const systems = xmlTexts(block, 'OS')
      .map((os) => ({
        build: Number(xmlText(os, 'OSBuildId')),
        release: xmlText(os, 'OSReleaseIdFilename'),
        windows11: xmlText(os, 'IsWindows11') === 'true',
        bits: xmlText(os, 'OSArchitecture')
      }))
      .filter((os) => os.build > 0 && os.release && os.bits === '64')
    return { id, name: xmlTexts(block, 'ProductName')[0] ?? id, systems }
  }
  return null
}

/**
 * The Windows version whose reference to use: this one if HP lists it,
 * else the newest HP lists that isn't newer (same Windows 10/11), else the
 * oldest newer one.
 */
export function chooseWindows(systems, osBuild) {
  const build = Number(osBuild) || 0
  const windows11 = build >= FIRST_WINDOWS_11_BUILD
  const same = systems.filter((os) => os.windows11 === windows11)
  const pool = same.length > 0 ? same : systems
  const byBuild = [...pool].sort((a, b) => a.build - b.build)
  return (
    byBuild.find((os) => os.build === build) ??
    byBuild.filter((os) => os.build < build).pop() ??
    byBuild[0] ??
    null
  )
}

export function referencePath(platformId, os) {
  const id = platformId.toLowerCase()
  const windows = os.windows11 ? '11.0' : '10.0'
  return `${id}/${id}_64_${windows}.${os.release.toLowerCase()}.cab`
}

// ---------- Reference file ----------

// "03/28/2024" → "2024-03-28"
function isoDate(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text ?? '').trim())
  if (!match) return /^\d{4}-\d{2}-\d{2}$/.test(text ?? '') ? text : null
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

const https = (url) => (url ? `https://${url.replace(/^\w+:\/\//, '')}` : null)

// Some SoftPaqs say in this field that they can't install silently
const isUsableCommand = (command) =>
  Boolean(command) && !/\bnot? support|^(na|none)$/i.test(command.trim())

/** The SoftPaqs and HP's devices in a reference file. */
export function parseReference(xml) {
  const devicesStart = xml.indexOf('<Devices>')
  const devicesEnd = xml.indexOf('</Devices>')
  const supersededAt = xml.indexOf('<Solutions-Superseded>')
  const solutionsXml = xml.slice(
    devicesEnd >= 0 ? devicesEnd : 0,
    supersededAt >= 0 ? supersededAt : undefined
  )

  const softpaqs = new Map()
  for (const block of solutionsXml.split('<UpdateInfo').slice(1)) {
    const id = xmlText(block, 'Id')
    const category = xmlText(block, 'Category')
    const url = https(xmlText(block, 'Url'))
    const sha256 = xmlText(block, 'SHA256')
    if (!id || !category || !url || !sha256) continue
    softpaqs.set(id, {
      id,
      name: xmlText(block, 'Name') ?? id,
      category,
      version: xmlText(block, 'Version'),
      releaseType: xmlText(block, 'ReleaseType'),
      silentInstall: xmlText(block, 'SilentInstall'),
      url,
      infoUrl: https(xmlText(block, 'ReleaseNotesUrl')),
      sha256,
      size: Number(xmlText(block, 'Size')) || 0,
      date: xmlText(block, 'DateReleased'),
      biosFamilies: xmlTexts(block, 'BiosFamily').map((family) => family.toUpperCase())
    })
  }

  const devices = []
  if (devicesStart >= 0 && devicesEnd > devicesStart) {
    for (const block of xml.slice(devicesStart, devicesEnd).split('<Device>').slice(1)) {
      const hardwareId = xmlText(block, 'DeviceId')
      if (!hardwareId) continue
      devices.push({
        hardwareId,
        version: xmlText(block, 'DriverVersion'),
        date: isoDate(xmlText(block, 'DriverDate')),
        provider: xmlText(block, 'DriverProvider'),
        softpaqIds: [...block.matchAll(/<UpdateInfo [^>]*>/g)]
          .map((m) => xmlAttribute(m[0], 'IdRef'))
          .filter(Boolean)
      })
    }
  }
  return { softpaqs, devices }
}

// "T76 Ver. 01.25.00" → { family: 'T76', version: '01.25.00' }
export function parseHpBios(version) {
  const match = /^\s*([A-Z]\d{2})\s+Ver\.\s*([\d.]+)/i.exec(String(version ?? ''))
  return match ? { family: match[1].toUpperCase(), version: match[2] } : null
}

const DOTTED_VERSION = /^\d+(\.\d+)+$/

/** Drivers ({ softpaq, version, ... , hardwareIds }) and the BIOS for this computer. */
export function matchReference(reference, system, computerDevices) {
  // One candidate per SoftPaq and driver version: a SoftPaq can carry
  // drivers of different versions (video and display audio)
  const groups = new Map()
  for (const device of reference.devices) {
    if (!DOTTED_VERSION.test(device.version ?? '')) continue
    for (const softpaqId of device.softpaqIds) {
      const softpaq = reference.softpaqs.get(softpaqId)
      if (!softpaq || !/^driver/i.test(softpaq.category)) continue
      if (!isUsableCommand(softpaq.silentInstall)) continue
      const key = `${softpaq.id}:${device.version}`
      if (!groups.has(key)) groups.set(key, { softpaq, device, ids: [] })
      groups.get(key).ids.push(device.hardwareId)
    }
  }
  const drivers = []
  for (const [key, { softpaq, device, ids }] of groups) {
    const hardwareIds = devicesNamed(ids, computerDevices)
    if (hardwareIds.length === 0) continue
    drivers.push({
      key,
      softpaq,
      version: device.version,
      date: device.date,
      provider: device.provider,
      hardwareIds
    })
  }

  const installed = parseHpBios(system?.version)
  const bios = installed
    ? ([...reference.softpaqs.values()].find(
        (softpaq) =>
          /^bios/i.test(softpaq.category) && softpaq.biosFamilies.includes(installed.family)
      ) ?? null)
    : null
  return { drivers, bios, installedBios: installed }
}

// ---------- The source ----------

async function loadReference(system) {
  await mkdir(CACHE_DIR, { recursive: true })
  const listCab = path.join(CACHE_DIR, 'platformList.cab')
  if (!(await isFresh(listCab, CATALOG_MAX_AGE_MS)))
    await download(`${REF_URL}platformList.cab`, listCab, { maker: MAKER })
  const platform = findPlatform(await readCab(listCab), system.board)
  if (!platform) return null
  const os = chooseWindows(platform.systems, system.osBuild)
  if (!os) return { platform, reference: null }
  const relPath = referencePath(platform.id, os)
  const refCab = path.join(CACHE_DIR, path.basename(relPath))
  if (!(await isFresh(refCab, CATALOG_MAX_AGE_MS)))
    await download(REF_URL + relPath, refCab, { maker: MAKER })
  return { platform, os, reference: parseReference(await readCab(refCab)) }
}

export async function find({ inventory }) {
  const { system, devices } = await inventory
  if (!system) return { error: 'The computer model couldn’t be read.' }
  void pruneOld(PACKAGES_DIR)
  const loaded = await loadReference(system)
  if (!loaded?.reference) {
    return {
      drivers: [],
      bios: [],
      summary: null,
      biosNote: loaded
        ? `HP publishes no 64-bit Windows reference for ${loaded.platform.name}.`
        : `HP publishes no reference for ${system.model || 'this model'} (platform ${system.board || 'unknown'}).`
    }
  }
  const { platform, os, reference } = loaded
  const match = matchReference(reference, system, devices)

  const toCandidate = (softpaq, extra) => ({
    label: `${softpaq.name} · ${softpaq.id}`,
    softpaqId: softpaq.id,
    url: softpaq.url,
    sha256: softpaq.sha256,
    size: softpaq.size,
    silentInstall: softpaq.silentInstall,
    infoUrl: softpaq.infoUrl,
    ...extra
  })

  const drivers = match.drivers.map((driver) =>
    toCandidate(driver.softpaq, {
      key: `hp:${driver.key}`,
      hardwareIds: driver.hardwareIds,
      version: driver.version,
      date: driver.date,
      provider: driver.provider || 'HP'
    })
  )

  let biosNote = null
  if (!match.installedBios) {
    biosNote = `HP's BIOS version "${system.version ?? ''}" couldn’t be read, so no BIOS is offered.`
  } else if (!match.bios) {
    biosNote = `HP's reference has no BIOS for the ${match.installedBios.family} family.`
  }
  const windows = `Windows ${os.windows11 ? '11' : '10'} ${os.release}`
  return {
    drivers,
    bios: match.bios
      ? [
          toCandidate(match.bios, {
            key: `hp:${match.bios.id}`,
            version: match.bios.version,
            installedVersion: match.installedBios.version,
            date: match.bios.date,
            notes: match.bios.releaseType
              ? `HP rates this update: ${match.bios.releaseType}.`
              : null
          })
        ]
      : [],
    biosNote,
    summary: `HP's reference for ${platform.name} (${windows}) has ${drivers.length} driver${drivers.length === 1 ? '' : 's'} for this hardware`
  }
}

async function fetchSoftpaq(candidate) {
  const file = path.join(PACKAGES_DIR, `${candidate.softpaqId}.exe`)
  await download(candidate.url, file, { maker: MAKER, sha256: candidate.sha256 })
  // HP signs every SoftPaq ("HP Inc."); anything else is refused even if the hash matched
  await checkSignature(file, /\bHP\b/i, MAKER)
  return file
}

// 3010: installed, restart needed; 1641: the installer started a restart
const SUCCESS_CODES = { 0: false, 3010: true, 1641: true }

async function installSoftpaq(candidate) {
  const file = await fetchSoftpaq(candidate)
  const dir = path.join(PACKAGES_DIR, candidate.softpaqId)
  await rm(dir, { recursive: true, force: true })
  // -e: extract only, -s: silently, -f: to this folder
  const extracted = await run(file, ['-e', '-s', `-f${dir}`], { timeoutMs: EXTRACT_TIMEOUT_MS })
  if (extracted !== 0) {
    return { success: false, message: `HP's SoftPaq couldn’t be extracted (code ${extracted}).` }
  }
  const code = await runCommandLine(candidate.silentInstall, {
    cwd: dir,
    timeoutMs: INSTALL_TIMEOUT_MS
  })
  if (code in SUCCESS_CODES) return { success: true, rebootRequired: SUCCESS_CODES[code] }
  return {
    success: false,
    message: `HP's installer failed (code ${code}). The extracted SoftPaq is in ${dir}.`
  }
}

/** Downloads, verifies and silently installs each SoftPaq once, one after the other. */
export async function install(candidates) {
  const results = {}
  const bySoftpaq = new Map()
  for (const candidate of candidates) {
    let result = bySoftpaq.get(candidate.softpaqId)
    if (!result) {
      result = await installSoftpaq(candidate).catch((err) => ({
        success: false,
        message: errorMessage(err)
      }))
      bySoftpaq.set(candidate.softpaqId, result)
    }
    results[candidate.key] = result
  }
  return results
}

/** The BIOS SoftPaq, downloaded and verified; it runs with its own window. */
export async function prepareBios(candidate) {
  return { file: await fetchSoftpaq(candidate), args: '' }
}
