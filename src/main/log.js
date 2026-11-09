import { app, shell } from 'electron'
import os from 'os'
import path from 'path'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync
} from 'fs'

/* global __EDITION__ */

/*
 * The error log: one plain-text file in the settings folder, so whoever
 * tests WinDiag can see what failed and send it. It records crashes, IPC
 * calls that threw, checks and actions that failed, and errors in the page.
 *
 * <settings folder>\logs\errors.log, up to 1 MB; the previous one is kept as
 * errors.old.log. Nothing leaves the PC.
 */

const MAX_BYTES = 1024 * 1024
const MAX_TEXT = 4000

let folder = null
let sessionHeaderWritten = false

/** Call after the edition's settings folder is set. */
export function initLog() {
  folder = path.join(app.getPath('userData'), 'logs')
  process.on('uncaughtException', (error) => logError('main', 'Uncaught exception', error))
  process.on('unhandledRejection', (reason) =>
    logError('main', 'Unhandled promise rejection', reason)
  )
  app.on('render-process-gone', (_event, _contents, details) =>
    logError(
      'main',
      'The window’s page stopped',
      `${details.reason} (exit code ${details.exitCode})`
    )
  )
  app.on('child-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit')
      logError('main', `A helper process stopped: ${details.type}`, details.reason)
  })
}

export function logFilePath() {
  return folder ? path.join(folder, 'errors.log') : null
}

const clip = (text) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}… (cut)` : text)

function describe(detail) {
  if (detail === undefined || detail === null || detail === '') return ''
  if (detail instanceof Error) return detail.stack || `${detail.name}: ${detail.message}`
  if (typeof detail === 'string') return detail
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

/**
 * Adds one entry. `source` says where it happened (main, page, checkup,
 * an IPC channel…); `message` is one line; `detail` an Error, text or data.
 */
export function logError(source, message, detail) {
  const file = logFilePath()
  if (!file) return
  try {
    mkdirSync(folder, { recursive: true })
    if (existsSync(file) && statSync(file).size > MAX_BYTES) {
      renameSync(file, path.join(folder, 'errors.old.log'))
      sessionHeaderWritten = false
    }
    let text = ''
    if (!sessionHeaderWritten) {
      text +=
        `\n=== WinDiag ${app.getVersion()} (${__EDITION__}) · ${os.type()} ${os.release()} ${os.arch()}` +
        ` · started ${new Date(Date.now() - process.uptime() * 1000).toISOString()} ===\n`
      sessionHeaderWritten = true
    }
    const body = clip(describe(detail))
    text += `${new Date().toISOString()} [${clip(String(source))}] ${clip(String(message))}\n`
    if (body) text += body.replace(/^/gm, '    ') + '\n'
    appendFileSync(file, text, 'utf8')
  } catch {
    // The log must never break the app
  }
}

/** Opens the log in the default text editor, or its folder when it's empty. */
export async function openLog() {
  const file = logFilePath()
  if (!file) return false
  mkdirSync(folder, { recursive: true })
  const error = existsSync(file) ? await shell.openPath(file) : await shell.openPath(folder)
  return !error
}

export function showLogInFolder() {
  const file = logFilePath()
  if (file && existsSync(file)) shell.showItemInFolder(file)
  else if (folder) {
    mkdirSync(folder, { recursive: true })
    void shell.openPath(folder)
  }
  return true
}

/** How many entries the log has, and how big it is. */
export function getLogInfo() {
  const file = logFilePath()
  if (!file || !existsSync(file)) return { path: file, entries: 0, bytes: 0 }
  const { size } = statSync(file)
  return { path: file, bytes: size, entries: countEntries(file) }
}

function countEntries(file) {
  try {
    const text = readFileSync(file, 'utf8')
    return (text.match(/^\d{4}-\d{2}-\d{2}T[^\n]*\[/gm) ?? []).length
  } catch {
    return 0
  }
}

export function clearLog() {
  if (!folder) return false
  rmSync(path.join(folder, 'errors.log'), { force: true })
  rmSync(path.join(folder, 'errors.old.log'), { force: true })
  sessionHeaderWritten = false
  return true
}
