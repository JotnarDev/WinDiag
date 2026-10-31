// Lenovo's own catalog: the one Lenovo System Update and Thin Installer
// read, public on download.lenovo.com. Only loaded on Lenovo computers (see
// index.js).
//
// 1. catalog/<MT>_Win11.xml (or _Win10) lists every package for the machine
//    type, the first four characters of the model Windows reports
//    ("20XWCTO1WW" → 20XW), each with the address and SHA-256 of its
//    descriptor.
// 2. A descriptor (n32ww12w_2_.xml) says what the package is, the devices
//    it's for, the driver version it installs, its installer's SHA-256 and
//    the commands that extract and install it.
// 3. Drivers are extracted and installed silently with those commands; the
//    BIOS runs with its own window.
//
// Every installer is checked against its descriptor's SHA-256 and Lenovo's
// digital signature before it runs.
import path from 'path'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { compareBiosVersions } from '../driver-catalog'
import {
  CATALOG_MAX_AGE_MS,
  cacheDir,
  checkSignature,
  decodeXml,
  devicesNamed,
  download,
  errorMessage,
  fetchText,
  isFresh,
  mapLimit,
  pruneOld,
  runCommandLine,
  xmlAttribute,
  xmlText,
  xmlTexts
} from './maker-files'

const MAKER = 'Lenovo'
const CATALOG_URL = 'https://download.lenovo.com/catalog/'
const CACHE_DIR = cacheDir('lenovo')
const DESCRIPTORS_DIR = path.join(CACHE_DIR, 'descriptors')
const PACKAGES_DIR = path.join(CACHE_DIR, 'packages')
const EXTRACT_TIMEOUT_MS = 10 * 60e3
const INSTALL_TIMEOUT_MS = 30 * 60e3
const FIRST_WINDOWS_11_BUILD = 22000

// Lenovo's package types and restart behaviour
const TYPE_DRIVER = '2'
const TYPE_BIOS = '3'
// 0: no restart, 3: restart needed afterwards. 1 (the installer restarts the
// computer itself), 4 (shuts it down) and 5 (restarts it later) can't run
// among other installs.
const REBOOT_NONE = '0'
const REBOOT_REQUIRED = '3'

// ---------- Catalog ----------

/** "20XWCTO1WW" → "20XW". */
export function machineType(model) {
  const type = String(model ?? '')
    .trim()
    .slice(0, 4)
    .toUpperCase()
  return /^[0-9A-Z]{4}$/.test(type) ? type : null
}

/** The packages a catalog lists: [{ url, category, sha256 }]. */
export function parseCatalog(xml) {
  return xmlTexts(xml, 'package')
    .map((block) => ({
      url: xmlText(block, 'location'),
      category: xmlText(block, 'category'),
      sha256: /<checksum type="sha256">([0-9a-f]{64})</i.exec(block)?.[1] ?? null
    }))
    .filter((pkg) => pkg.url && /^https:\/\//.test(pkg.url))
}

// ---------- Descriptors ----------

const section = (xml, element) =>
  new RegExp(`<${element}(?:\\s[^>]*)?>([\\s\\S]*?)</${element}>`).exec(xml)?.[1] ?? ''

/** One package's descriptor, reduced to what WinDiag uses. */
export function parseDescriptor(xml, url) {
  const head = /<Package [^>]*>/.exec(xml)?.[0] ?? ''
  const detectVersion = /<DetectVersion type="Inf"[^>]*>([\s\S]*?)<\/DetectVersion>/.exec(xml)?.[1]
  const detectInstall = section(xml, 'DetectInstall')
  const installTag = /<Install [^>]*>/.exec(xml)?.[0] ?? ''
  const installer = section(section(xml, 'Files'), 'Installer')
  const readme = section(section(xml, 'Files'), 'Readme')
  const base = url.slice(0, url.lastIndexOf('/') + 1)
  const readmeName = xmlText(readme, 'Name')
  return {
    id: xmlAttribute(head, 'id'),
    version: xmlAttribute(head, 'version'),
    title: xmlText(section(xml, 'Title'), 'Desc'),
    type: /<PackageType type="(\d+)"/.exec(xml)?.[1] ?? null,
    reboot: /<Reboot type="(\d+)"/.exec(xml)?.[1] ?? null,
    severity: /<Severity type="(\d+)"/.exec(xml)?.[1] ?? null,
    date: xmlText(xml, 'ReleaseDate'),
    extractCommand: xmlText(xml, 'ExtractCommand'),
    installCommand: xmlText(section(xml, 'Install'), 'Cmdline'),
    successCodes: (xmlAttribute(installTag, 'rc') ?? '0')
      .split(',')
      .map((code) => Number(code.trim()))
      .filter(Number.isFinite),
    pnpIds: detectVersion ? xmlTexts(detectVersion, '_PnPID') : [],
    // The driver versions (and dates) installed once the package is
    driverVersions: xmlTexts(detectInstall, '_Driver').map((driver) => ({
      hardwareIds: xmlTexts(driver, 'HardwareID'),
      // "6.0.9764.1^" is that version or newer; "6.0.9764.1^10.0", up to 10.0
      version: (xmlText(driver, 'Version') ?? '').split('^')[0].trim(),
      date: xmlText(driver, 'Date')
    })),
    biosLevels: xmlTexts(section(detectInstall, '_Bios'), 'Level'),
    installerName: xmlText(installer, 'Name'),
    installerSha256: xmlText(installer, 'CRC'),
    installerSize: Number(xmlText(installer, 'Size')) || 0,
    base,
    infoUrl: readmeName ? base + readmeName : null
  }
}

const DOTTED_VERSION = /^\d+(\.\d+)+$/

const isoDate = (text) => (/^\d{4}-\d{2}-\d{2}$/.test(text ?? '') ? text : null)

/**
 * What a package installs: [{ version, date, ids }]. A package can carry
 * drivers of different versions for different devices (Realtek audio), each
 * named in its DetectInstall; without one, the package's own version counts
 * for every device it names.
 */
export function packageDrivers(pkg) {
  const byVersion = new Map()
  for (const driver of pkg.driverVersions) {
    if (!DOTTED_VERSION.test(driver.version) || driver.hardwareIds.length === 0) continue
    if (!byVersion.has(driver.version))
      byVersion.set(driver.version, {
        version: driver.version,
        date: isoDate(driver.date),
        ids: []
      })
    byVersion.get(driver.version).ids.push(...driver.hardwareIds)
  }
  if (byVersion.size > 0) return [...byVersion.values()]
  return DOTTED_VERSION.test(pkg.version ?? '') && pkg.pnpIds.length > 0
    ? [{ version: pkg.version, date: null, ids: pkg.pnpIds }]
    : []
}

/**
 * Lenovo's BIOS version as Windows reports it: "N32ET88W (1.64 )". The
 * first part is the build ("N32ET" family, "88" revision), the part in
 * brackets the version the descriptors use.
 */
export function parseLenovoBios(version) {
  const text = String(version ?? '').trim()
  const match = /^(\S+)\s*\(\s*([\d.]+)\s*\)/.exec(text)
  return match ? { build: match[1].toUpperCase(), version: match[2] } : null
}

/** Drivers and the BIOS for this computer, from the parsed descriptors. */
export function matchPackages(packages, system, computerDevices) {
  const drivers = []
  for (const pkg of packages) {
    if (pkg.type !== TYPE_DRIVER || !pkg.installCommand || !pkg.installerSha256) continue
    if (pkg.reboot !== REBOOT_NONE && pkg.reboot !== REBOOT_REQUIRED) continue
    for (const driver of packageDrivers(pkg)) {
      const hardwareIds = devicesNamed(driver.ids, computerDevices)
      if (hardwareIds.length > 0)
        drivers.push({ pkg, version: driver.version, date: driver.date, hardwareIds })
    }
  }

  // The BIOS whose build family ("N32ET") is this computer's
  const installed = parseLenovoBios(system?.version)
  let bios = null
  if (installed) {
    for (const pkg of packages) {
      if (pkg.type !== TYPE_BIOS || !pkg.installerSha256 || !pkg.version) continue
      const families = pkg.biosLevels.map((level) =>
        level
          .replace(/\*$/, '')
          .replace(/[0-9A-Z]{2}$/i, '')
          .toUpperCase()
      )
      if (!families.some((family) => family && installed.build.startsWith(family))) continue
      if (!bios || compareBiosVersions(pkg.version, bios.version) > 0) bios = pkg
    }
  }
  return { drivers, bios, installedBios: installed }
}

// ---------- The source ----------

async function loadCatalog(type, windows) {
  await mkdir(CACHE_DIR, { recursive: true })
  const file = path.join(CACHE_DIR, `${type}_${windows}.xml`)
  if (await isFresh(file, CATALOG_MAX_AGE_MS)) {
    const cached = await readFile(file, 'utf8').catch(() => null)
    if (cached != null) return cached === '' ? null : cached
  }
  const xml = await fetchText(`${CATALOG_URL}${type}_${windows}.xml`, MAKER)
  // A missing catalog is remembered too, as an empty file
  await writeFile(file, xml ?? '').catch(() => {})
  return xml
}

async function loadDescriptor(entry) {
  const file = path.join(DESCRIPTORS_DIR, path.basename(new URL(entry.url).pathname))
  await download(entry.url, file, { maker: MAKER, sha256: entry.sha256 })
  return parseDescriptor(decodeXml(await readFile(file)), entry.url)
}

export async function find({ inventory }) {
  const { system, devices } = await inventory
  if (!system) return { error: 'The computer model couldn’t be read.' }
  const type = machineType(system.model)
  const windows = Number(system.osBuild) >= FIRST_WINDOWS_11_BUILD ? 'Win11' : 'Win10'
  const xml = type ? await loadCatalog(type, windows) : null
  if (!xml) {
    return {
      drivers: [],
      bios: [],
      summary: null,
      biosNote: `Lenovo publishes no ${windows.replace('Win', 'Windows ')} catalog for ${system.model || 'this model'}.`
    }
  }
  void pruneOld(PACKAGES_DIR)
  // Descriptors that can't be read are skipped; the rest still count
  const entries = parseCatalog(xml)
  const packages = (
    await mapLimit(entries, 8, (entry) => loadDescriptor(entry).catch(() => null))
  ).filter(Boolean)
  const match = matchPackages(packages, system, devices)

  const toCandidate = (pkg, extra) => ({
    label: `${pkg.title ?? pkg.id} · ${pkg.id}`,
    packageId: pkg.id,
    url: pkg.base + pkg.installerName,
    sha256: pkg.installerSha256,
    size: pkg.installerSize,
    extractCommand: pkg.extractCommand,
    installCommand: pkg.installCommand,
    successCodes: pkg.successCodes,
    restartAfter: pkg.reboot === REBOOT_REQUIRED,
    infoUrl: pkg.infoUrl,
    ...extra
  })

  const drivers = match.drivers.map((driver) =>
    toCandidate(driver.pkg, {
      key: `lenovo:${driver.pkg.id}:${driver.version}`,
      hardwareIds: driver.hardwareIds,
      version: driver.version,
      date: driver.date,
      provider: 'Lenovo'
    })
  )

  let biosNote = null
  if (!match.installedBios) {
    biosNote = `Lenovo's BIOS version "${system.version ?? ''}" couldn’t be read, so no BIOS is offered.`
  } else if (!match.bios) {
    biosNote = `Lenovo's catalog has no BIOS for the ${match.installedBios.build} BIOS.`
  }
  const unread = entries.length - packages.length
  return {
    drivers,
    bios: match.bios
      ? [
          toCandidate(match.bios, {
            key: `lenovo:${match.bios.id}`,
            version: match.bios.version,
            installedVersion: match.installedBios.version,
            date: match.bios.date,
            // Severity 1 is Lenovo's "Critical"
            notes: match.bios.severity === '1' ? 'Lenovo rates this update: Critical.' : null
          })
        ]
      : [],
    biosNote,
    summary:
      `Lenovo's catalog for ${type} (${windows.replace('Win', 'Windows ')}) has ${drivers.length} driver${drivers.length === 1 ? '' : 's'} for this hardware` +
      (unread > 0 ? ` (${unread} of its packages couldn’t be read)` : '')
  }
}

async function fetchInstaller(candidate) {
  const dir = path.join(PACKAGES_DIR, candidate.packageId)
  const file = path.join(dir, path.basename(new URL(candidate.url).pathname))
  await download(candidate.url, file, { maker: MAKER, sha256: candidate.sha256 })
  // Lenovo signs every installer; anything else is refused even if the hash matched
  await checkSignature(file, /\bLenovo\b/i, MAKER)
  return { dir, file }
}

const withPackagePath = (command, dir) => command.replace(/%PACKAGEPATH%/gi, dir)

async function installPackage(candidate) {
  const { dir } = await fetchInstaller(candidate)
  // The installer extracts next to itself, then the install command runs from there
  await rm(path.join(dir, 'TMP'), { recursive: true, force: true })
  if (candidate.extractCommand) {
    const extracted = await runCommandLine(withPackagePath(candidate.extractCommand, dir), {
      cwd: dir,
      timeoutMs: EXTRACT_TIMEOUT_MS
    })
    if (extracted !== 0) {
      return {
        success: false,
        message: `Lenovo's package couldn’t be extracted (code ${extracted}).`
      }
    }
  }
  const code = await runCommandLine(withPackagePath(candidate.installCommand, dir), {
    cwd: dir,
    timeoutMs: INSTALL_TIMEOUT_MS
  })
  if (!candidate.successCodes.includes(code)) {
    return {
      success: false,
      message: `Lenovo's installer failed (code ${code}). The package is in ${dir}.`
    }
  }
  return { success: true, rebootRequired: code === 3010 || candidate.restartAfter }
}

/** Downloads, verifies and silently installs each package once, one after the other. */
export async function install(candidates) {
  const results = {}
  const byPackage = new Map()
  for (const candidate of candidates) {
    let result = byPackage.get(candidate.packageId)
    if (!result) {
      result = await installPackage(candidate).catch((err) => ({
        success: false,
        message: errorMessage(err)
      }))
      byPackage.set(candidate.packageId, result)
    }
    results[candidate.key] = result
  }
  return results
}

/** The BIOS package, downloaded and verified; it runs with its own window. */
export async function prepareBios(candidate) {
  return { file: (await fetchInstaller(candidate)).file, args: '' }
}
