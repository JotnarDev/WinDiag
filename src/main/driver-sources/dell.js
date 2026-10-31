// Dell's own catalog: the one Dell Command | Update reads, public on
// downloads.dell.com. Only loaded on Dell computers (see index.js).
//
// 1. CatalogIndexPC.cab lists one catalog per model, keyed by the model's
//    systemID, which Windows reports as the SystemSKUNumber ("0A9D").
// 2. That model's catalog (Latitude_0A9D.cab, ~300 KB) lists every BIOS,
//    driver and firmware package Dell has published for it, each with its
//    version, supported Windows versions, devices and SHA-256 hash.
// 3. Each package is a Dell Update Package (.exe): drivers install silently
//    (/s); the BIOS runs with its own window, like any other BIOS updater.
//
// Every file is checked against the catalog's SHA-256 and Dell's digital
// signature before it runs. Only BIOS and drivers that name their devices
// (PCI or USB IDs) are used: the others can't be matched to this hardware.
import os from 'os'
import path from 'path'
import { createHash } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, readdir, readFile, rename, rm, stat } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { compareBiosVersions } from '../driver-catalog'
import { runPowerShell } from '../powershell'

const execFileAsync = promisify(execFile)

const BASE_URL = 'https://downloads.dell.com/'
const INDEX_PATH = 'catalog/CatalogIndexPC.cab'
const CACHE_DIR = path.join(os.tmpdir(), 'WinDiag', 'dell')
// Dell refreshes the index daily; a few hours old is fresh enough
const INDEX_MAX_AGE_MS = 6 * 60 * 60e3
// Downloaded packages are kept a week, so a second install doesn't download again
const PACKAGE_MAX_AGE_MS = 7 * 24 * 60 * 60e3
const DOWNLOAD_TIMEOUT_MS = 15 * 60e3
const INSTALL_TIMEOUT_MS = 20 * 60e3

// The Windows architecture Dell names in its catalogs
const OS_ARCH = { x64: 'x64', arm64: 'ARM64' }[process.arch] ?? 'x64'

// ---------- Files ----------

async function sha256Of(file) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

async function isFresh(file, maxAgeMs) {
  try {
    return Date.now() - (await stat(file)).mtimeMs < maxAgeMs
  } catch {
    return false
  }
}

/** Downloads a file from Dell, checking its SHA-256 when the catalog gives one. */
async function download(relPath, file, sha256 = null) {
  await mkdir(path.dirname(file), { recursive: true })
  if (sha256 && (await isFresh(file, PACKAGE_MAX_AGE_MS))) {
    if ((await sha256Of(file).catch(() => '')) === sha256.toLowerCase()) return file
  }
  const response = await fetch(BASE_URL + relPath.replace(/^\/+/, ''), {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
  }).catch((err) => {
    throw new Error(
      `Dell's server couldn't be reached (${err.message}). Check the internet connection.`
    )
  })
  if (!response.ok || !response.body) {
    throw new Error(`Dell's server answered ${response.status} for ${relPath}.`)
  }
  const partial = `${file}.partial`
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial))
  if (sha256 && (await sha256Of(partial)) !== sha256.toLowerCase()) {
    await rm(partial, { force: true })
    throw new Error(
      `${path.basename(relPath)} didn't match the hash in Dell's catalog, so it was deleted.`
    )
  }
  await rm(file, { force: true })
  await rename(partial, file)
  return file
}

/** Extracts a .cab with Windows' own expand.exe and returns its XML as text. */
async function readCab(cab) {
  const dir = `${cab}.extracted`
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  await execFileAsync(path.join(systemRoot, 'System32', 'expand.exe'), ['-F:*', cab, dir], {
    windowsHide: true,
    timeout: 60e3
  })
  const xml = (await readdir(dir)).find((name) => name.toLowerCase().endsWith('.xml'))
  if (!xml) throw new Error(`${path.basename(cab)} has no catalog inside.`)
  const bytes = await readFile(path.join(dir, xml))
  // Dell's catalogs are UTF-16 with a byte-order mark; the driver pack one is ASCII
  return bytes[0] === 0xff && bytes[1] === 0xfe
    ? bytes.subarray(2).toString('utf16le')
    : bytes.toString('utf8')
}

async function pruneOldPackages() {
  const dir = path.join(CACHE_DIR, 'packages')
  const names = await readdir(dir).catch(() => [])
  await Promise.all(
    names.map(async (name) => {
      const file = path.join(dir, name)
      if (!(await isFresh(file, PACKAGE_MAX_AGE_MS)))
        await rm(file, { force: true }).catch(() => {})
    })
  )
}

// ---------- Catalog XML ----------

const attribute = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null
const firstText = (block, element) =>
  new RegExp(`<${element}[^>]*>\\s*<Display[^>]*><!\\[CDATA\\[([^\\]]*)\\]\\]>`)
    .exec(block)?.[1]
    ?.trim() ?? null
const sha256In = (block) => /<Hash algorithm="SHA256">([0-9a-f]{64})</i.exec(block)?.[1] ?? null

// "October 14, 2026" → "2026-10-14"
function isoDate(text) {
  const date = new Date(text ?? '')
  if (Number.isNaN(date.getTime())) return null
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The index entry of this model's catalog: by systemID, else by model name. */
function findModelCatalog(indexXml, system) {
  const sku = String(system.sku ?? '')
    .trim()
    .toUpperCase()
  const model = String(system.model ?? '')
    .trim()
    .toLowerCase()
  let byName = null
  for (const block of indexXml.split('<GroupManifest').slice(1)) {
    const info = /<ManifestInformation[^>]*>/.exec(block)?.[0]
    if (!info) continue
    const entry = {
      path: attribute(info, 'path'),
      sha256: sha256In(block.slice(block.indexOf('<ManifestInformation'))),
      name: firstText(block, 'Model') ?? model
    }
    if (!entry.path) continue
    const ids = [...block.matchAll(/<Model systemID="([0-9A-Fa-f]+)"/g)].map((m) =>
      m[1].toUpperCase()
    )
    if (sku && ids.includes(sku)) return entry
    const names = [...block.matchAll(/<Model[^>]*>\s*<Display[^>]*><!\[CDATA\[([^\]]*)\]\]>/g)].map(
      (m) => m[1].trim().toLowerCase()
    )
    if (!byName && model && names.some((name) => name === model || `latitude ${name}` === model)) {
      byName = entry
    }
  }
  return byName
}

/** Every package in a model catalog that runs on this Windows. */
function parsePackages(xml) {
  const packages = []
  for (const block of xml.split('<SoftwareComponent').slice(1)) {
    const head = block.slice(0, block.indexOf('>'))
    const type = /<ComponentType value="(\w+)"/.exec(block)?.[1]
    // BIOS packages list no Windows at all: they run on any
    const runsHere =
      !block.includes('<SupportedOperatingSystems>') ||
      new RegExp(`<OperatingSystem[^>]*osArch="${OS_ARCH}"[^>]*majorVersion="10"`).test(block)
    const relPath = attribute(head, 'path')
    const sha256 = sha256In(block)
    if (!type || !runsHere || !relPath || !sha256) continue
    packages.push({
      type,
      relPath,
      sha256,
      id: attribute(head, 'packageID') ?? attribute(head, 'releaseID'),
      version: attribute(head, 'vendorVersion'),
      date: isoDate(attribute(head, 'releaseDate')),
      size: Number(attribute(head, 'size')) || 0,
      name: firstText(block, 'Name') ?? path.basename(relPath),
      criticality: firstText(block, 'Criticality'),
      infoUrl: attribute(/<ImportantInfo[^>]*>/.exec(block)?.[0] ?? '', 'URL'),
      devices: [...block.matchAll(/<PCIInfo ([^>]*)\/>/g)].map((m) => ({
        vendor: (attribute(m[1], 'vendorID') ?? '').toUpperCase(),
        device: (attribute(m[1], 'deviceID') ?? '').toUpperCase(),
        subVendor: (attribute(m[1], 'subVendorID') ?? '').toUpperCase(),
        subDevice: (attribute(m[1], 'subDeviceID') ?? '').toUpperCase()
      }))
    })
  }
  return packages
}

// The computer's devices that a package names: PCI-style "VEN_x&DEV_y" (also
// used by HD audio) or USB "VID_x&PID_y", with the subsystem when Dell gives
// one. Returns the device's own most specific hardware ID, so the comparison
// matches it exactly.
function matchDevices(pkg, devices) {
  const ids = new Set()
  for (const { vendor, device, subVendor, subDevice } of pkg.devices) {
    if (!/^[0-9A-F]{4}$/.test(vendor) || !/^[0-9A-F]{4}$/.test(device)) continue
    const part = new RegExp(
      `(^|[\\\\&])(VEN_${vendor}&DEV_${device}|VID_${vendor}&PID_${device})(&|$)`
    )
    const subsystem = subVendor && subDevice ? `SUBSYS_${subDevice}${subVendor}` : null
    for (const dev of devices) {
      const hardwareIds = (dev.hw ?? []).map((id) => String(id).toUpperCase())
      const hit = hardwareIds.some((id) => part.test(id) && (!subsystem || id.includes(subsystem)))
      if (hit && hardwareIds[0]) ids.add(hardwareIds[0])
    }
  }
  return [...ids]
}

// ---------- The source ----------

async function loadModelCatalog(system) {
  await mkdir(CACHE_DIR, { recursive: true })
  const indexCab = path.join(CACHE_DIR, 'CatalogIndexPC.cab')
  if (!(await isFresh(indexCab, INDEX_MAX_AGE_MS))) await download(INDEX_PATH, indexCab)
  const entry = findModelCatalog(await readCab(indexCab), system)
  if (!entry) return null
  const modelCab = path.join(CACHE_DIR, path.basename(entry.path))
  if (!(await isFresh(modelCab, INDEX_MAX_AGE_MS)))
    await download(entry.path, modelCab, entry.sha256)
  return { name: entry.name, packages: parsePackages(await readCab(modelCab)) }
}

const DOTTED_VERSION = /^\d+(\.\d+)+$/

export async function find({ inventory }) {
  const { system, devices } = await inventory
  if (!system) return { error: 'The computer model couldn’t be read.' }
  void pruneOldPackages()
  const catalog = await loadModelCatalog(system)
  if (!catalog) {
    return {
      drivers: [],
      bios: [],
      summary: null,
      biosNote: `Dell publishes no catalog for ${system.model || 'this model'}.`
    }
  }

  const toCandidate = (pkg, extra) => ({
    key: `dell:${pkg.relPath}`,
    version: pkg.version,
    label: `${pkg.name} · ${pkg.id}`,
    relPath: pkg.relPath,
    sha256: pkg.sha256,
    size: pkg.size,
    infoUrl: pkg.infoUrl,
    ...extra
  })

  const newestBios = catalog.packages
    .filter((pkg) => pkg.type === 'BIOS' && pkg.version)
    .reduce(
      (best, pkg) => (!best || compareBiosVersions(pkg.version, best.version) > 0 ? pkg : best),
      null
    )

  // Driver versions only compare when they look like driver versions; the
  // release date is Dell's, not the driver's, so it isn't used to compare
  const drivers = catalog.packages
    .filter((pkg) => pkg.type === 'DRVR' && DOTTED_VERSION.test(pkg.version ?? ''))
    .map((pkg) =>
      toCandidate(pkg, { hardwareIds: matchDevices(pkg, devices), date: null, provider: 'Dell' })
    )
    .filter((candidate) => candidate.hardwareIds.length > 0)

  return {
    drivers,
    bios: newestBios
      ? [
          toCandidate(newestBios, {
            date: newestBios.date,
            notes: newestBios.criticality
              ? `Dell rates this update: ${newestBios.criticality}.`
              : null
          })
        ]
      : [],
    biosNote: newestBios ? null : `Dell's catalog has no BIOS for ${catalog.name}.`,
    summary: `Dell's catalog for ${catalog.name} has ${drivers.length} driver${drivers.length === 1 ? '' : 's'} for this hardware`
  }
}

// Dell signs every package; anything else is refused even if the hash matched
async function checkSignature(file) {
  const output = await runPowerShell(
    `try { $s = Get-AuthenticodeSignature -LiteralPath '${file.replace(/'/g, "''")}'; "$($s.Status)|$($s.SignerCertificate.Subject)" } catch { 'Error|' }`,
    60e3
  ).catch(() => 'Error|')
  const [status, subject = ''] = output.trim().split('|')
  if (status !== 'Valid' || !/\bDell\b/i.test(subject)) {
    throw new Error(`${path.basename(file)} isn’t signed by Dell (${status}), so it wasn’t run.`)
  }
}

async function fetchPackage(candidate) {
  const file = path.join(CACHE_DIR, 'packages', path.basename(candidate.relPath))
  await download(candidate.relPath, file, candidate.sha256)
  await checkSignature(file)
  return file
}

// Dell Update Package exit codes
const DUP_EXIT = {
  0: { success: true },
  2: { success: true, rebootRequired: true },
  3: {
    success: true,
    notApplied: true,
    message:
      'Dell’s installer found the same or a newer version already installed, or no device for it.'
  },
  4: { success: false, message: 'Dell’s installer is missing a prerequisite on this computer.' },
  5: {
    success: false,
    message: 'Dell’s installer says this package doesn’t apply to this computer.'
  },
  6: { success: true, rebootRequired: true }
}

/** Downloads, verifies and silently runs each driver package, one after the other. */
export async function install(candidates) {
  const results = {}
  for (const candidate of candidates) {
    try {
      const file = await fetchPackage(candidate)
      const log = `${file}.log`
      let code = 0
      try {
        await execFileAsync(file, ['/s', `/l=${log}`], {
          windowsHide: true,
          timeout: INSTALL_TIMEOUT_MS
        })
      } catch (err) {
        code = typeof err.code === 'number' ? err.code : -1
      }
      results[candidate.key] = DUP_EXIT[code] ?? {
        success: false,
        message: `Dell’s installer failed (code ${code}). Its log is in ${log}.`
      }
    } catch (err) {
      results[candidate.key] = {
        success: false,
        message: err instanceof Error ? err.message : String(err)
      }
    }
  }
  return results
}

/** The BIOS package, downloaded and verified; it runs with its own window. */
export async function prepareBios(candidate) {
  return { file: await fetchPackage(candidate), args: '' }
}
