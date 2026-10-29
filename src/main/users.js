import { parseJsonArray, runPowerShell } from './powershell'
import { isRunningElevated, notElevatedResult } from './system-tools'

const cleanString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// Built-in accounts are recognized by the last part of their SID (RID),
// since their names are localized ("Administrador") and can be renamed:
// Administrator, Guest, DefaultAccount, WDAGUtilityAccount
const BUILT_IN_ACCOUNT_RIDS = new Set(['500', '501', '503', '504'])

function isBuiltInAccount(sid) {
  return BUILT_IN_ACCOUNT_RIDS.has(sid.split('-').pop())
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
  try {
    const rows = parseJsonArray(await runPowerShell(USERS_PS_SCRIPT, 15e3))
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
        isBuiltIn: isBuiltInAccount(sid),
        passwordRequired: Boolean(raw.PasswordRequired),
        lastLogon: cleanString(raw.LastLogon)
      })
    }
    return users
  } catch {
    return []
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
  // Same rule as Local Users and Groups: any account can be deleted (the
  // signed-in one and disabled ones included) except the built-in ones
  if (target.isBuiltIn) {
    return {
      success: false,
      message: `The following error occurred while attempting to delete the user ${target.name}: Cannot perform this operation on built-in accounts.`
    }
  }
  if (!(await isRunningElevated())) return notElevatedResult('delete a user account')
  const output = await runPowerShell(
    `try { Remove-LocalUser -Name '${escapeForSingleQuotedPs(target.name)}' -ErrorAction Stop; 'ok' } catch { $_.Exception.Message }`,
    15e3
  ).catch((err) => (err instanceof Error ? err.message : String(err)))
  if (output.trim() !== 'ok') {
    return { success: false, message: output.trim() || 'The account could not be deleted.' }
  }
  return {
    success: true,
    message: `User "${target.name}" was deleted. This removes the Windows account only — their profile folder and files under C:\\Users\\${target.name} are left in place.`
  }
}
