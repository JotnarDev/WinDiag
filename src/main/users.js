import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { unlink, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)
const cleanString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const BUILT_IN_ACCOUNT_NAMES = new Set([
  'administrator',
  'guest',
  'defaultaccount',
  'wdagutilityaccount'
])

function isBuiltInAccountName(name) {
  return BUILT_IN_ACCOUNT_NAMES.has(name.toLowerCase())
}

const USERS_PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
    $users = Get-LocalUser
    $admins = @()
    try {
        $admins = Get-LocalGroupMember -Group 'Administrators' -ErrorAction Stop |
            Where-Object { $_.ObjectClass -eq 'User' } |
            ForEach-Object { $_.SID.Value }
    } catch {}
    $currentSid = ([System.Security.Principal.WindowsIdentity]::GetCurrent()).User.Value

    $result = $users | ForEach-Object {
        [PSCustomObject]@{
            Name             = $_.Name
            FullName         = $_.FullName
            Enabled          = [bool]$_.Enabled
            SID              = $_.SID.Value
            PasswordRequired = [bool]$_.PasswordRequired
            LastLogon        = if ($_.LastLogon) { $_.LastLogon.ToString('o') } else { $null }
            IsAdmin          = $admins -contains $_.SID.Value
            IsCurrent        = $_.SID.Value -eq $currentSid
        }
    }
    $result | ConvertTo-Json -Compress
} catch {
    ''
}
`.trim()
export async function getWindowsUsers() {
  const scriptPath = path.join(os.tmpdir(), `windiag-users-${randomUUID()}.ps1`)
  try {
    await writeFile(scriptPath, USERS_PS_SCRIPT, 'utf-8')
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { windowsHide: true, timeout: 8e3 }
    )
    const trimmed = stdout.trim()
    if (!trimmed) return []
    const parsed = JSON.parse(trimmed)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    const users = []
    for (const raw of rows) {
      const name = cleanString(raw.Name)
      const sid = cleanString(raw.SID)
      if (!name || !sid) continue
      users.push({
        sid,
        name,
        fullName: cleanString(raw.FullName),
        enabled: Boolean(raw.Enabled),
        isAdmin: Boolean(raw.IsAdmin),
        isCurrentUser: Boolean(raw.IsCurrent),
        isBuiltIn: isBuiltInAccountName(name),
        passwordRequired: Boolean(raw.PasswordRequired),
        lastLogon: cleanString(raw.LastLogon)
      })
    }
    return users
  } catch {
    return []
  } finally {
    await unlink(scriptPath).catch(() => void 0)
  }
}

function escapeForSingleQuotedPs(value) {
  return value.replace(/'/g, "''")
}

export async function deleteWindowsUser(name) {
  const trimmedName = name.trim()
  if (!trimmedName) {
    return { success: false, message: 'No username was provided.' }
  }
  const users = await getWindowsUsers()
  const target = users.find((u) => u.name.toLowerCase() === trimmedName.toLowerCase())
  if (!target) {
    return {
      success: false,
      message: `User "${trimmedName}" was not found (it may have already been deleted).`
    }
  }
  if (target.name.toLowerCase() === 'administrator') {
    return {
      success: false,
      message: `"Administrator" is a protected built-in account and can't be deleted here.`
    }
  }
  if (!target.enabled) {
    return {
      success: false,
      message: `"${target.name}" is disabled and can't be deleted here.`
    }
  }
  try {
    await execAsync(
      `powershell -NoProfile -NonInteractive -Command "Remove-LocalUser -Name '${escapeForSingleQuotedPs(
        target.name
      )}'"`,
      { windowsHide: true, timeout: 1e4 }
    )
    return {
      success: true,
      message: `User "${target.name}" was deleted. This removes the Windows account only — their profile folder and files under C:\\Users\\${target.name} are left in place.`
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    if (/access is denied/i.test(raw)) {
      return {
        success: false,
        message:
          'Access denied. Close WinDiag and reopen it as Administrator (right-click the app → "Run as administrator") to delete a user account.'
      }
    }
    return { success: false, message: raw }
  }
}
