// Drivers from Windows Update, through the Windows Update Agent API that
// Windows itself uses (Microsoft.Update.Session). Nothing to host: Microsoft
// serves every driver, signed, for any brand of laptop or desktop.
//
// A search returns only drivers that apply to this computer's hardware and
// that Windows ranks above the installed ones. Each runs in its own
// PowerShell process: a search takes a minute or two, an install longer, and
// the shared session must stay free for the pages' quick queries.
import { runPowerShellIsolated } from '../powershell'
import { withWindowsUpdateAccess } from '../windows-update'

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

/** The drivers Windows Update offers for this computer, as driver candidates. */
export async function find() {
  if (process.platform !== 'win32') return { error: 'Windows Update only works on Windows.' }
  let parsed
  try {
    parsed = parseOutput(
      await withWindowsUpdateAccess(() => runPowerShellIsolated(SEARCH_SCRIPT, SEARCH_TIMEOUT_MS))
    )
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
  if (!parsed.ok) return { error: explain(parsed) }
  const drivers = (Array.isArray(parsed.updates) ? parsed.updates : [])
    .filter((u) => u?.id && u.hw)
    .map((u) => {
      const title = String(u.title ?? '')
      return {
        key: `wu:${u.id}`,
        hardwareIds: [String(u.hw).toUpperCase()],
        version: VERSION_AT_END.exec(title)?.[1] ?? null,
        date: u.date ?? null,
        provider: u.provider || u.manufacturer || null,
        label: title,
        // Windows Update only offers what it ranks above the installed driver
        trusted: true,
        updateId: String(u.id)
      }
    })
  return {
    drivers,
    bios: [],
    summary: `Windows Update offers ${drivers.length} driver${drivers.length === 1 ? '' : 's'}`
  }
}

const UPDATE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// IUpdateInstaller result codes
const SUCCEEDED = 2
const SUCCEEDED_WITH_ERRORS = 3

/** Downloads and installs the given Windows Update drivers in one go. */
export async function install(candidates) {
  const keyById = new Map(
    candidates.filter((c) => UPDATE_ID.test(c.updateId)).map((c) => [c.updateId, c.key])
  )
  const everyone = (outcome) =>
    Object.fromEntries(candidates.map((c) => [c.key, { success: false, ...outcome }]))
  if (keyById.size === 0) return everyone({ message: 'No Windows Update driver to install.' })
  let parsed
  try {
    parsed = parseOutput(
      await withWindowsUpdateAccess(() =>
        runPowerShellIsolated(installScript([...keyById.keys()]), INSTALL_TIMEOUT_MS)
      )
    )
  } catch (err) {
    return everyone({ message: err instanceof Error ? err.message : String(err) })
  }
  if (!parsed.ok) return everyone({ message: explain(parsed) })
  const results = everyone({
    message: 'Windows Update no longer offers this driver. Compare again.'
  })
  for (const u of parsed.updates ?? []) {
    const key = keyById.get(String(u.id))
    if (!key) continue
    const success = u.result === SUCCEEDED || u.result === SUCCEEDED_WITH_ERRORS
    results[key] = success
      ? { success, rebootRequired: Boolean(parsed.reboot) }
      : { success, message: explain({ code: u.code, error: 'the driver could not be installed.' }) }
  }
  return results
}

export async function prepareBios() {
  throw new Error('Windows Update doesn’t offer BIOS updates here.')
}
