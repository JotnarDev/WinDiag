import { app } from 'electron'
import path from 'path'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { execFile, execFileSync } from 'child_process'
import { promisify } from 'util'
import { isRunningElevated } from './system-tools'

const execFileAsync = promisify(execFile)

// Windows only honours AllowEdgeSwipe as a machine policy (HKLM\...\Policies),
// which needs administrator rights. The previous HKCU\...\CurrentVersion\EdgeUI
// value is not read by Windows, so it never actually blocked the gestures.
const POLICY_KEY = 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\EdgeUI'
const VALUE_NAME = 'AllowEdgeSwipe'

// The value that was there before the touch test is saved to disk, so it can
// still be restored on the next launch if WinDiag crashes or is killed while
// the test is running.
const restoreFile = () => path.join(app.getPath('userData'), 'edge-swipe-restore.json')

// Set once this process has written the policy, so shutdown only restores
// what this session changed (and, by construction, while elevated).
let appliedThisSession = false

const reg = (args) => execFileAsync('reg', args, { windowsHide: true, timeout: 5e3 })

async function readCurrentValue() {
  try {
    const { stdout } = await reg(['query', POLICY_KEY, '/v', VALUE_NAME])
    const match = /REG_DWORD\s+0x([0-9a-f]+)/i.exec(stdout)
    return match ? parseInt(match[1], 16) : null
  } catch {
    // reg query exits non-zero when the value doesn't exist
    return null
  }
}

function restoreArgs(originalValue) {
  return originalValue === null
    ? ['delete', POLICY_KEY, '/v', VALUE_NAME, '/f']
    : ['add', POLICY_KEY, '/v', VALUE_NAME, '/t', 'REG_DWORD', '/d', String(originalValue), '/f']
}

function readSnapshot() {
  try {
    return existsSync(restoreFile()) ? JSON.parse(readFileSync(restoreFile(), 'utf8')) : null
  } catch {
    return null
  }
}

function clearSnapshot() {
  try {
    unlinkSync(restoreFile())
  } catch {
    // already gone
  }
}

export async function setEdgeGesturesDisabled(disabled) {
  if (disabled) {
    if (readSnapshot()) return { applied: true, message: null }
    if (!(await isRunningElevated())) {
      return {
        applied: false,
        message:
          'Edge-swipe gestures are still active: blocking them needs WinDiag to run as Administrator.'
      }
    }
    try {
      const originalValue = await readCurrentValue()
      writeFileSync(restoreFile(), JSON.stringify({ originalValue }))
      await reg(['add', POLICY_KEY, '/v', VALUE_NAME, '/t', 'REG_DWORD', '/d', '0', '/f'])
      appliedThisSession = true
      return { applied: true, message: null }
    } catch (err) {
      clearSnapshot()
      return { applied: false, message: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
  const snapshot = readSnapshot()
  if (!snapshot) return { applied: false, message: null }
  try {
    await reg(restoreArgs(snapshot.originalValue))
  } catch {
    // value already matches the original state
  }
  clearSnapshot()
  return { applied: false, message: null }
}

/** Synchronous restore for app shutdown. */
export function restoreEdgeGesturesSync() {
  if (!appliedThisSession) return
  const snapshot = readSnapshot()
  if (!snapshot) return
  try {
    execFileSync('reg', restoreArgs(snapshot.originalValue), { windowsHide: true, timeout: 5e3 })
  } catch {
    // value already matches the original state
  }
  clearSnapshot()
}

/**
 * Restores a value left behind by a crash during the touch test. Without
 * admin rights the write would fail, so the snapshot is kept for the next
 * elevated launch instead of being discarded.
 */
export async function recoverEdgeGestures() {
  if (!readSnapshot() || !(await isRunningElevated())) return
  await setEdgeGesturesDisabled(false)
}
