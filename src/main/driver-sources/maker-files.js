// What every maker's catalog source needs: downloading packages from the
// maker's server, checking them (SHA-256 from the catalog, then the maker's
// digital signature) before anything runs, reading .cab catalogs, running
// installers and matching the hardware IDs the maker names to this computer.
import os from 'os'
import path from 'path'
import { createHash } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, readdir, readFile, rename, rm, stat } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { runPowerShell } from '../powershell'

const execFileAsync = promisify(execFile)

const DOWNLOAD_TIMEOUT_MS = 15 * 60e3
// Downloaded packages are kept a week, so a second install doesn't download again
export const PACKAGE_MAX_AGE_MS = 7 * 24 * 60 * 60e3
// Makers refresh their catalogs daily; a few hours old is fresh enough
export const CATALOG_MAX_AGE_MS = 6 * 60 * 60e3

/**
 * The folder for one maker's files. Under ProgramData rather than %TEMP%:
 * makers' install commands take the folder as a bare argument
 * (/DIR=C:\...), which breaks on a user name with a space.
 */
export function cacheDir(maker) {
  const base = process.env.ProgramData || os.tmpdir()
  return path.join(base, 'WinDiag', 'drivers', maker)
}

export async function sha256Of(file) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

export async function isFresh(file, maxAgeMs) {
  try {
    return Date.now() - (await stat(file)).mtimeMs < maxAgeMs
  } catch {
    return false
  }
}

/**
 * Downloads `url` to `file`, checking its SHA-256 when the catalog gives one.
 * A file already there with the right hash isn't downloaded again.
 */
export async function download(url, file, { maker, sha256 = null } = {}) {
  await mkdir(path.dirname(file), { recursive: true })
  const expected = sha256 ? sha256.toLowerCase() : null
  if (expected && (await isFresh(file, PACKAGE_MAX_AGE_MS))) {
    if ((await sha256Of(file).catch(() => '')) === expected) return file
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) }).catch(
    (err) => {
      throw new Error(
        `${maker}'s server couldn't be reached (${err.message}). Check the internet connection.`
      )
    }
  )
  if (!response.ok || !response.body) {
    const error = new Error(
      `${maker}'s server answered ${response.status} for ${path.basename(url)}.`
    )
    error.status = response.status
    throw error
  }
  const partial = `${file}.partial`
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial))
  if (expected && (await sha256Of(partial)) !== expected) {
    await rm(partial, { force: true })
    throw new Error(
      `${path.basename(file)} didn't match the hash in ${maker}'s catalog, so it was deleted.`
    )
  }
  await rm(file, { force: true })
  await rename(partial, file)
  return file
}

/** Downloads a small text file (a catalog), or null when the server has none (404). */
export async function fetchText(url, maker) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60e3) }).catch((err) => {
    throw new Error(
      `${maker}'s server couldn't be reached (${err.message}). Check the internet connection.`
    )
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${maker}'s server answered ${response.status}.`)
  return stripBom(await response.text())
}

export const stripBom = (text) => text.replace(/^\uFEFF/, '')

/** Extracts a .cab with Windows' own expand.exe and returns its XML as text. */
export async function readCab(cab) {
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
  return decodeXml(await readFile(path.join(dir, xml)))
}

/** XML bytes as text: UTF-16 with a byte-order mark, or UTF-8. */
export function decodeXml(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le')
  return stripBom(bytes.toString('utf8'))
}

/** Deletes files and folders in `dir` older than a week. */
export async function pruneOld(dir) {
  const names = await readdir(dir).catch(() => [])
  await Promise.all(
    names.map(async (name) => {
      const target = path.join(dir, name)
      if (!(await isFresh(target, PACKAGE_MAX_AGE_MS)))
        await rm(target, { recursive: true, force: true }).catch(() => {})
    })
  )
}

/**
 * Refuses a file that isn't validly signed by the maker, even if its hash
 * matched: `signer` is tested on the certificate's subject.
 */
export async function checkSignature(file, signer, maker) {
  const output = await runPowerShell(
    `try { $s = Get-AuthenticodeSignature -LiteralPath '${file.replace(/'/g, "''")}'; "$($s.Status)|$($s.SignerCertificate.Subject)" } catch { 'Error|' }`,
    60e3
  ).catch(() => 'Error|')
  const [status, subject = ''] = output.trim().split('|')
  if (status !== 'Valid' || !signer.test(subject)) {
    throw new Error(
      `${path.basename(file)} isn’t signed by ${maker} (${status}), so it wasn’t run.`
    )
  }
}

/** Runs a program and returns its exit code (-1 if it couldn't start or timed out). */
export async function run(file, args, { cwd, timeoutMs }) {
  try {
    await execFileAsync(file, args, { cwd, windowsHide: true, timeout: timeoutMs })
    return 0
  } catch (err) {
    return typeof err.code === 'number' ? err.code : -1
  }
}

/** Runs a maker's install command line (as written in its catalog) through cmd.exe. */
export function runCommandLine(commandLine, { cwd, timeoutMs }) {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  return new Promise((resolve) => {
    execFile(
      path.join(systemRoot, 'System32', 'cmd.exe'),
      ['/d', '/s', '/c', `"${commandLine}"`],
      { cwd, windowsHide: true, timeout: timeoutMs, windowsVerbatimArguments: true },
      (err) => resolve(err ? (typeof err.code === 'number' ? err.code : -1) : 0)
    )
  })
}

/** Runs `task` on every item, at most `limit` at a time. */
export async function mapLimit(items, limit, task) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * The computer's devices a maker's hardware ID names, as each device's own
 * most specific hardware ID (so the comparison matches it exactly). A full ID
 * ("PCI\VEN_8086&DEV_9A49") must equal one of the device's; a partial one
 * ("VEN_10EC&DEV_0897", as Lenovo writes audio codecs) must appear in one
 * between separators.
 */
export function devicesNamed(ids, devices) {
  const exact = new Set()
  const partial = []
  for (const raw of ids) {
    const id = String(raw).trim().toUpperCase()
    if (!id) continue
    if (id.includes('\\') || id.startsWith('*')) exact.add(id)
    else partial.push(new RegExp(`(^|[\\\\&])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(&|$)`))
  }
  const found = new Set()
  for (const device of devices) {
    const hardwareIds = (device.hw ?? []).map((id) => String(id).toUpperCase())
    if (!hardwareIds[0]) continue
    const hit = hardwareIds.some(
      (id) => exact.has(id) || partial.some((pattern) => pattern.test(id))
    )
    if (hit) found.add(hardwareIds[0])
  }
  return [...found]
}

export const errorMessage = (err) => (err instanceof Error ? err.message : String(err))

// Plain XML helpers for makers' catalogs (they're simple and regular enough)
export const xmlText = (block, element) => {
  const match = new RegExp(`<${element}(?:\\s[^>]*)?>([\\s\\S]*?)</${element}>`).exec(block)
  return match ? decodeEntities(match[1]).trim() : null
}

export const xmlTexts = (block, element) =>
  [...block.matchAll(new RegExp(`<${element}(?:\\s[^>]*)?>([\\s\\S]*?)</${element}>`, 'g'))].map(
    (m) => decodeEntities(m[1]).trim()
  )

export const xmlAttribute = (tag, name) => {
  const value = new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1]
  return value == null ? null : decodeEntities(value)
}

export function decodeEntities(text) {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
}
