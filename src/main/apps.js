import { spawn } from 'child_process'
import { mkdtemp, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { APP_CATALOG, APP_GROUPS, packagesOf } from './app-catalog'
import { logError } from './log'

/*
 * The home edition's Apps page, on top of winget (App Installer), which
 * comes with Windows 10 and 11. Apps install one at a time; the page follows
 * along through 'apps:progress' events and can stop after the current app.
 */

const isWindows = process.platform === 'win32'
const AGREE = ['--accept-source-agreements', '--disable-interactivity']
const INSTALL_TIMEOUT = 45 * 60e3

function requireWindows() {
  if (!isWindows) throw new Error('Only available on Windows')
}

// winget's own result codes worth explaining (HRESULTs, unsigned)
const RESULTS = {
  0x8a150061: { ok: true, note: 'Already installed' },
  0x8a15002b: { ok: true, note: 'Already up to date' },
  0x8a150109: { ok: true, note: 'Restart Windows to finish' },
  0x8a15010a: { ok: false, error: 'Restart Windows, then try again.' },
  0x8a150014: { ok: false, error: 'winget couldn’t find this app.' },
  0x8a150011: { ok: false, error: 'The download didn’t match what was expected. Try again later.' },
  0x8a150008: { ok: false, error: 'The download failed. Check your internet connection.' },
  0x8a15010c: { ok: false, error: 'Another installation is running. Try again when it ends.' },
  0x8a150103: { ok: false, error: 'Close the app first, then try again.' }
}

// winget redraws its progress with \r; keep what each line ends up showing
const cleanLines = (text) =>
  text.split(/\r?\n/).map((line) => line.slice(line.lastIndexOf('\r') + 1).trimEnd())

/** Runs winget; resolves { code, out } (code unsigned), or code null if it isn't there. */
function winget(args, { timeoutMs = 120e3 } = {}) {
  return new Promise((resolve) => {
    let out = ''
    let child
    try {
      child = spawn('winget', args, { windowsHide: true })
    } catch {
      resolve({ code: null, out: '' })
      return
    }
    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('error', () => {
      clearTimeout(timer)
      resolve({ code: null, out })
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code: code === null ? null : code >>> 0, out, killed: Boolean(signal) })
    })
  })
}

/**
 * Reads winget's table output (list, upgrade): the column starts come from
 * the header, the line above the dashes. Works whatever the language.
 */
export function parseTable(text) {
  const lines = cleanLines(text)
  const dashes = lines.findIndex((l) => /^-{10,}$/.test(l.trim()))
  if (dashes < 1) return []
  const header = lines[dashes - 1]
  const starts = [...header.matchAll(/\S+/g)].map((m) => m.index)
  if (starts.length < 3) return []
  const cell = (row, i) => row.slice(starts[i], starts[i + 1] ?? undefined).trim()
  const rows = []
  for (const row of lines.slice(dashes + 1)) {
    if (!row.trim()) break
    const id = cell(row, 1)
    // The table ends where a line no longer has an id in its column
    if (!/^[\w.+-]+…?$/.test(id) || !/[.…]|^[0-9A-Z]{12}$/.test(id)) break
    rows.push({
      name: cell(row, 0),
      id,
      version: cell(row, 2),
      available: starts.length > 4 ? cell(row, 3) : null,
      source: starts.length > 4 ? cell(row, 4) || null : null
    })
  }
  return rows
}

/** What winget knows is installed: lower-cased id → id. */
async function installedPackages() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'windiag-'))
  const file = path.join(dir, 'apps.json')
  try {
    const { code } = await winget(['export', '-o', file, ...AGREE], { timeoutMs: 90e3 })
    if (code === null) return null
    const data = JSON.parse((await readFile(file, 'utf8')).replace(/^﻿/, ''))
    return new Map(
      (data.Sources ?? []).flatMap((s) =>
        (s.Packages ?? []).map((p) => [
          String(p.PackageIdentifier).toLowerCase(),
          String(p.PackageIdentifier)
        ])
      )
    )
  } catch (error) {
    logError('apps', 'Couldn’t read the installed apps', error?.message ?? String(error))
    return new Map()
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Apps with an update. winget shortens long ids when its output isn't a
 * console ("Microsoft.VisualStudi…"); those are completed from the
 * installed list, or dropped when that isn't clear.
 */
async function availableUpdates(installed) {
  const { code, out } = await winget(['upgrade', ...AGREE], { timeoutMs: 90e3 })
  if (code === null) return null
  return parseTable(out)
    .filter((r) => r.available)
    .map((r) => {
      if (!r.id.endsWith('…')) return r
      const prefix = r.id.slice(0, -1).toLowerCase()
      const matches = [...installed.keys()].filter((id) => id.startsWith(prefix))
      return matches.length === 1 ? { ...r, id: installed.get(matches[0]) } : null
    })
    .filter(Boolean)
}

/** The catalog, what is installed and which apps have updates. */
export async function getApps() {
  requireWindows()
  const installed = await installedPackages()
  if (installed === null) return { available: false }
  const updates = (await availableUpdates(installed)) ?? []
  return {
    available: true,
    groups: APP_GROUPS,
    apps: APP_CATALOG.map((entry) => ({
      id: entry.id,
      group: entry.group,
      name: entry.name,
      text: entry.text,
      installed: packagesOf(entry).every((p) => installed.has(p.id.toLowerCase()))
    })),
    updates: updates.map(({ id, name, version, available }) => ({ id, name, version, available }))
  }
}

/* --- Jobs ------------------------------------------------------------------ */

// One job at a time: { kind, items: [{ id, name, state, note, error }], stopping }
let job = null
const listeners = new Set()

function publish() {
  const snapshot = getAppsJob()
  for (const sender of listeners) {
    if (sender.isDestroyed()) listeners.delete(sender)
    else sender.send('apps:progress', snapshot)
  }
}

/** The running or last job, for a page that opens while it runs. */
export function getAppsJob() {
  return job && JSON.parse(JSON.stringify(job))
}

function resultOf({ code, out, killed }) {
  if (killed) return { ok: false, error: 'It took too long and was stopped.' }
  if (code === 0) return { ok: true }
  const known = RESULTS[code]
  if (known) return known
  // winget's last words say what went wrong, e.g. "Installer failed with exit code: 1603"
  const last = cleanLines(out)
    .map((l) => l.trim())
    .filter((l) => l && !/^[-\\|/█▒\s\d.%KMGB]+$/.test(l))
    .pop()
  return { ok: false, error: last ?? `winget ended with code 0x${code.toString(16)}` }
}

async function runJob(kind, items, sender, step) {
  requireWindows()
  if (job && !job.done) throw new Error('Another installation is running')
  listeners.add(sender)
  job = {
    kind,
    items: items.map((i) => ({ id: i.id, name: i.name, state: 'waiting' })),
    stopping: false,
    done: false
  }
  publish()
  for (const [index, item] of items.entries()) {
    const entry = job.items[index]
    if (job.stopping) {
      entry.state = 'skipped'
      continue
    }
    entry.state = 'running'
    publish()
    const result = await step(item)
    entry.state = result.ok ? 'done' : 'failed'
    if (result.note) entry.note = result.note
    if (result.error) {
      entry.error = result.error
      logError(
        'apps',
        `${kind === 'install' ? 'Installing' : 'Updating'} ${item.name} failed`,
        result.error
      )
    }
    publish()
  }
  job.done = true
  publish()
  return getAppsJob()
}

const sourceArgs = (source) => (source ? ['--source', source] : [])

function runWinget(verb, pkg) {
  return winget(
    [
      verb,
      '--id',
      pkg.id,
      '--exact',
      ...sourceArgs(pkg.source),
      '--silent',
      '--accept-package-agreements',
      ...AGREE
    ],
    { timeoutMs: INSTALL_TIMEOUT }
  ).then(resultOf)
}

/** Installs catalog apps by id, one after another. */
export function installApps(ids, sender) {
  const byId = Object.fromEntries(APP_CATALOG.map((e) => [e.id, e]))
  const entries = ids.map((id) => {
    if (!byId[id]) throw new Error(`Unknown app: ${id}`)
    return byId[id]
  })
  if (entries.length === 0) throw new Error('Nothing to install')
  return runJob('install', entries, sender, async (entry) => {
    const notes = []
    for (const pkg of packagesOf(entry)) {
      const result = await runWinget('install', pkg)
      if (!result.ok) return result
      if (result.note && result.note !== 'Already installed') notes.push(result.note)
    }
    return { ok: true, note: notes[0] }
  })
}

/** Updates every app winget has an update for, one after another. */
export async function updateAllApps(sender) {
  requireWindows()
  if (job && !job.done) throw new Error('Another installation is running')
  const installed = await installedPackages()
  const updates = installed && (await availableUpdates(installed))
  if (!updates) throw new Error('winget isn’t available')
  if (updates.length === 0) return { kind: 'update', items: [], done: true }
  return runJob('update', updates, sender, (row) =>
    runWinget('upgrade', { id: row.id, source: row.source })
  )
}

/** Stops after the app being installed now; that one is left to finish. */
export function stopAppsJob() {
  if (job && !job.done) {
    job.stopping = true
    publish()
  }
  return true
}
