import os from 'os'
import path from 'path'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { runPowerShell, runPowerShellIsolated } from './powershell'
import { isRunningElevated } from './system-tools'

/*
 * Runs a PowerShell script with administrator rights, for the few actions of
 * the home edition that need them. When WinDiag already runs as
 * administrator it runs directly; otherwise Windows shows its UAC prompt for
 * this one action.
 *
 * The script's last value comes back as { ok: true, result }; errors as
 * { ok: false, error }, and a dismissed UAC prompt as { ok: false, cancelled }.
 * Scripts must not include anything the renderer sent unchecked.
 */
export async function runElevatedPowerShell(script, timeoutMs = 120e3) {
  if (await isRunningElevated()) {
    return parseResult(await runPowerShell(wrap(script, null), timeoutMs))
  }

  // The elevated process can't print to us, so it writes its answer to a
  // file in a folder only this user can reach
  const folder = await mkdtemp(path.join(os.tmpdir(), 'windiag-'))
  const resultFile = path.join(folder, 'result.json')
  try {
    const encoded = Buffer.from(wrap(script, resultFile), 'utf16le').toString('base64')
    const launcher = `
try {
    Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList @(
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', '${encoded}'
    )
    'started'
} catch {
    'cancelled'
}`
    const status = await runPowerShellIsolated(launcher, timeoutMs)
    if (status.includes('cancelled')) return { ok: false, cancelled: true }
    return parseResult(await readFile(resultFile, 'utf8'))
  } catch (error) {
    return { ok: false, error: error?.message ?? String(error) }
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

/** Runs an action's script, with admin rights only when it needs them. */
export async function runActionScript(script, { admin = false, timeoutMs = 120e3 } = {}) {
  if (admin) return runElevatedPowerShell(script, timeoutMs)
  try {
    return parseResult(await runPowerShell(wrap(script, null), timeoutMs))
  } catch (error) {
    return { ok: false, error: error?.message ?? String(error) }
  }
}

function wrap(script, resultFile) {
  const write = resultFile
    ? `| Set-Content -Encoding UTF8 -LiteralPath '${resultFile.replace(/'/g, "''")}'`
    : ''
  // The preference is set inside the block, so the shared PowerShell session
  // keeps its own
  return `
try {
    $result = & {
$ErrorActionPreference = 'Stop'
${script}
    }
    ConvertTo-Json -InputObject @{ ok = $true; result = $result } -Compress -Depth 6 ${write}
} catch {
    ConvertTo-Json -InputObject @{ ok = $false; error = $_.Exception.Message } -Compress ${write}
}`
}

function parseResult(text) {
  try {
    return JSON.parse(text.replace(/^﻿/, '').trim())
  } catch {
    return { ok: false, error: 'No answer from the elevated action' }
  }
}
