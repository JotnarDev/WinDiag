// Drivers from Windows Update, through the Windows Update Agent API that
// Windows itself uses (Microsoft.Update.Session). Nothing to host: Microsoft
// serves every driver, signed, for any brand of laptop or desktop.
//
// A search returns only drivers that apply to this computer's hardware and
// that Windows ranks above the installed ones. Each runs in its own
// PowerShell process: a search takes a minute or two, an install longer, and
// the shared session must stay free for the pages' quick queries.
import { runPowerShellIsolated } from './powershell'
import { withWindowsUpdateAccess } from './windows-update'

const SEARCH_TIMEOUT_MS = 6 * 60e3
const INSTALL_TIMEOUT_MS = 30 * 60e3

// ServerSelection 2 asks Microsoft's servers directly, even where a company
// update server (WSUS) is set for the rest of Windows Update
const SESSION = `
$session = New-Object -ComObject Microsoft.Update.Session
$session.ClientApplicationID = 'WinDiag'
$searcher = $session.CreateUpdateSearcher()
$searcher.ServerSelection = 2
$searcher.Online = $true
`

const failure = `ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{
    ok = $false; error = $_.Exception.Message; code = ('0x{0:X8}' -f $_.Exception.HResult)
})`

const SEARCH_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
${SESSION}
    $result = $searcher.Search("IsInstalled=0 and Type='Driver' and IsHidden=0")
    $list = foreach ($u in $result.Updates) {
        [PSCustomObject]@{
            id           = $u.Identity.UpdateID
            title        = $u.Title
            hw           = $u.DriverHardwareID
            date         = if ($u.DriverVerDate) { $u.DriverVerDate.ToString('yyyy-MM-dd') } else { $null }
            provider     = $u.DriverProvider
            manufacturer = $u.DriverManufacturer
            cls          = $u.DriverClass
            size         = [int64]$u.MaxDownloadSize
        }
    }
    ConvertTo-Json -Compress -Depth 3 -InputObject ([PSCustomObject]@{ ok = $true; updates = @($list) })
} catch { ${failure} }
`

const installScript = (ids) => `
$ErrorActionPreference = 'Stop'
try {
${SESSION}
    $ids = @(${ids.map((id) => `'${id}'`).join(', ')})
    $result = $searcher.Search("IsInstalled=0 and Type='Driver'")
    $updates = New-Object -ComObject Microsoft.Update.UpdateColl
    foreach ($u in $result.Updates) {
        if ($ids -contains $u.Identity.UpdateID) {
            if (-not $u.EulaAccepted) { $u.AcceptEula() }
            [void]$updates.Add($u)
        }
    }
    if ($updates.Count -eq 0) {
        ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ ok = $true; found = 0 })
        return
    }
    $downloader = $session.CreateUpdateDownloader()
    $downloader.Updates = $updates
    [void]$downloader.Download()
    $installer = $session.CreateUpdateInstaller()
    $installer.Updates = $updates
    $outcome = $installer.Install()
    $each = for ($i = 0; $i -lt $updates.Count; $i++) {
        $r = $outcome.GetUpdateResult($i)
        [PSCustomObject]@{
            id     = $updates.Item($i).Identity.UpdateID
            result = [int]$r.ResultCode
            code   = ('0x{0:X8}' -f $r.HResult)
        }
    }
    ConvertTo-Json -Compress -Depth 3 -InputObject ([PSCustomObject]@{
        ok = $true; found = $updates.Count; result = [int]$outcome.ResultCode
        reboot = [bool]$outcome.RebootRequired; updates = @($each)
    })
} catch { ${failure} }
`

// Windows Update errors a technician can act on
const KNOWN_ERRORS = {
  '0x8024402C': 'No internet connection, or a proxy is blocking Windows Update.',
  '0x80072EE7': 'No internet connection, or a proxy is blocking Windows Update.',
  '0x80072EFD': 'Windows Update could not be reached. Check the internet connection.',
  '0x8024002E': 'Windows Update access is blocked by a group policy on this computer.',
  '0x80070422':
    'The Windows Update service is disabled. Choose another mode in Tools → Windows Update.',
  '0x80240024': 'Windows Update found nothing to install.',
  '0x80240016': 'Windows is already installing updates. Try again when it finishes.'
}

const explain = (parsed) =>
  KNOWN_ERRORS[parsed.code] ?? `Windows Update failed (${parsed.code}): ${parsed.error}`

// "Intel Corporation - Display - 31.0.101.5186" → "31.0.101.5186"
const VERSION_AT_END = /(\d+(?:\.\d+){1,3})\s*$/

function parseOutput(output) {
  try {
    return JSON.parse(output)
  } catch {
    return { ok: false, error: output || 'No answer from Windows Update.', code: 'none' }
  }
}

/**
 * The drivers Windows Update offers for this computer:
 * { ok: true, updates: [{ updateId, title, hardwareId, version, date, provider, ... }] }
 * or { ok: false, error }.
 */
export async function searchWindowsUpdateDrivers() {
  if (process.platform !== 'win32')
    return { ok: false, error: 'Windows Update only works on Windows.' }
  try {
    const parsed = parseOutput(
      await withWindowsUpdateAccess(() => runPowerShellIsolated(SEARCH_SCRIPT, SEARCH_TIMEOUT_MS))
    )
    if (!parsed.ok) return { ok: false, error: explain(parsed) }
    const updates = (Array.isArray(parsed.updates) ? parsed.updates : [])
      .filter((u) => u?.id && u.hw)
      .map((u) => ({
        updateId: String(u.id),
        title: String(u.title ?? ''),
        hardwareId: String(u.hw).toUpperCase(),
        version: VERSION_AT_END.exec(String(u.title ?? ''))?.[1] ?? null,
        date: u.date ?? null,
        provider: u.provider || u.manufacturer || null,
        driverClass: u.cls ?? null,
        size: Number(u.size) || 0
      }))
    return { ok: true, updates }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

const UPDATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// IUpdateInstaller result codes
const SUCCEEDED = 2
const SUCCEEDED_WITH_ERRORS = 3

/**
 * Downloads and installs the given Windows Update drivers in one go.
 * Returns { success, message, rebootRequired, results: { [updateId]: { success, code } } }.
 */
export async function installWindowsUpdateDrivers(updateIds) {
  const ids = [
    ...new Set((Array.isArray(updateIds) ? updateIds : []).filter((id) => UPDATE_ID.test(id)))
  ]
  if (ids.length === 0)
    return { success: false, message: 'No Windows Update driver to install.', results: {} }
  let parsed
  try {
    parsed = parseOutput(
      await withWindowsUpdateAccess(() =>
        runPowerShellIsolated(installScript(ids), INSTALL_TIMEOUT_MS)
      )
    )
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
      results: {}
    }
  }
  if (!parsed.ok) return { success: false, message: explain(parsed), results: {} }
  if (!parsed.found) {
    return {
      success: false,
      message: 'Windows Update no longer offers this driver. Compare again.',
      results: {}
    }
  }
  const results = Object.fromEntries(
    (parsed.updates ?? []).map((u) => [
      String(u.id),
      { success: u.result === SUCCEEDED || u.result === SUCCEEDED_WITH_ERRORS, code: u.code }
    ])
  )
  const failed = Object.values(results).filter((r) => !r.success)
  return {
    success: failed.length === 0,
    rebootRequired: Boolean(parsed.reboot),
    message:
      failed.length === 0
        ? 'Installed from Windows Update.'
        : explain({ code: failed[0].code, error: 'the driver could not be installed.' }),
    results
  }
}
