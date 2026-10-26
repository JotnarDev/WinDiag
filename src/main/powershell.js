import { spawn, execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// One long-lived PowerShell process serves every quick query. Starting
// powershell.exe costs ~0.3–0.8 s of CPU (plus an antivirus scan), which used
// to happen several times per polling cycle. Commands run one at a time; each
// is sent base64-encoded on a single line so multi-line scripts, quotes and
// non-ASCII text survive the trip, and output comes back as UTF-8.
const DONE_MARKER = '__WINDIAG_PS_DONE__'
// After start-up the session is only used now and then, so it's closed when
// idle to give its memory back (a powershell.exe holds tens of MB) and
// reopened by the next command.
const IDLE_SHUTDOWN_MS = 60e3

let child = null
let buffer = ''
let current = null
const queue = []
let idleTimer = null

function startChild() {
  const proc = spawn(
    'powershell.exe',
    ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] }
  )
  child = proc
  proc.stdin.on('error', () => void 0)
  proc.stdout.setEncoding('utf8')
  proc.stdout.on('data', (chunk) => {
    if (child !== proc) return
    buffer += chunk
    const index = buffer.indexOf(DONE_MARKER)
    if (index === -1 || !current) return
    const output = buffer.slice(0, index)
    buffer = buffer.slice(index + DONE_MARKER.length).replace(/^\r?\n/, '')
    finishCurrent(null, output.trim())
  })
  const onExit = () => {
    if (child !== proc) return
    child = null
    buffer = ''
    if (current) {
      finishCurrent(
        new Error(
          current.timedOut ? 'PowerShell command timed out' : 'PowerShell exited unexpectedly'
        )
      )
    }
  }
  proc.on('exit', onExit)
  proc.on('error', onExit)
  proc.stdin.write('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n')
}

function finishCurrent(error, output) {
  const job = current
  current = null
  clearTimeout(job.timer)
  if (error) job.reject(error)
  else job.resolve(output)
  runNext()
}

// Detach before killing so a command queued meanwhile starts a fresh shell
// instead of writing to the one that is exiting.
function closeIdleChild() {
  const proc = child
  child = null
  buffer = ''
  proc?.kill()
}

function runNext() {
  if (current) return
  clearTimeout(idleTimer)
  if (queue.length === 0) {
    idleTimer = setTimeout(closeIdleChild, IDLE_SHUTDOWN_MS)
    return
  }
  if (!child) startChild()
  current = queue.shift()
  current.timer = setTimeout(() => {
    current.timedOut = true
    // A hung command would block the queue forever: kill the shell (the exit
    // handler rejects this job) and let the next job start a fresh one.
    child?.kill()
  }, current.timeoutMs)
  const encoded = Buffer.from(current.script, 'utf8').toString('base64')
  child.stdin.write(
    `try { & ([scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')))) | Out-String -Width 8192 | Write-Output } catch { } ; [Console]::Out.WriteLine('${DONE_MARKER}')\n`
  )
}

/**
 * Runs a script in the shared PowerShell session and resolves with its
 * trimmed text output. Scripts should catch their own errors and report them
 * in the output (e.g. as JSON), since stderr is discarded.
 */
export function runPowerShell(script, timeoutMs = 10e3) {
  return new Promise((resolve, reject) => {
    queue.push({ script, timeoutMs, resolve, reject })
    runNext()
  })
}

/**
 * Runs a script in its own short-lived PowerShell process. Only for scripts
 * that need a fresh STA apartment (WinRT async calls) or that can block for a
 * long time (GPS fix) and shouldn't hold up the shared session.
 */
export async function runPowerShellIsolated(script, timeoutMs) {
  const prelude = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n'
  const encoded = Buffer.from(prelude + script, 'utf16le').toString('base64')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Sta',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encoded
    ],
    { windowsHide: true, timeout: timeoutMs, encoding: 'utf8' }
  )
  return stdout.trim()
}

/** Parses JSON output from ConvertTo-Json, always returning an array. */
export function parseJsonArray(text) {
  if (!text) return []
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : [parsed]
}

export function stopPowerShell() {
  clearTimeout(idleTimer)
  queue.length = 0
  const proc = child
  child = null
  proc?.kill()
}
