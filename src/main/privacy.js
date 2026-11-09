import { runPowerShell } from './powershell'
import { runActionScript } from './elevated'

/*
 * The home edition's Privacy page. Each setting is a Windows feature the
 * person can turn off; turning it back on puts back exactly what Windows
 * has by default (the value it ships with, or no value at all).
 *
 * The registry values follow the privacy tweaks in Chris Titus Tech's
 * WinUtil (MIT licence, © 2022 CT Tech Group LLC), written again here and
 * limited to the safe, reversible ones.
 */

const isWindows = process.platform === 'win32'

const CDM = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager'

// Each value: where it lives, the value that turns the feature off, and what
// Windows has by default (null = no value).
const dword = (path, name, off, restore = null) => ({ path, name, type: 'DWord', off, restore })
const cdm = (name) => dword(CDM, name, 0, 1)

export const PRIVACY_SETTINGS = [
  {
    id: 'diagnostics',
    group: 'sharing',
    values: [
      dword('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection', 'AllowTelemetry', 0)
    ]
  },
  {
    id: 'tailored',
    group: 'sharing',
    values: [
      dword(
        'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Privacy',
        'TailoredExperiencesWithDiagnosticDataEnabled',
        0
      )
    ]
  },
  {
    id: 'advertisingId',
    group: 'sharing',
    values: [
      dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', 'Enabled', 0, 1)
    ]
  },
  {
    id: 'feedback',
    group: 'sharing',
    values: [dword('HKCU:\\Software\\Microsoft\\Siuf\\Rules', 'NumberOfSIUFInPeriod', 0)]
  },
  {
    id: 'activity',
    group: 'sharing',
    values: ['EnableActivityFeed', 'PublishUserActivities', 'UploadUserActivities'].map((name) =>
      dword('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System', name, 0)
    )
  },
  {
    id: 'location',
    group: 'location',
    values: [
      {
        path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location',
        name: 'Value',
        type: 'String',
        off: 'Deny',
        restore: 'Allow'
      }
    ]
  },
  {
    id: 'webSearch',
    group: 'ads',
    explorer: true,
    values: [
      dword(
        'HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer',
        'DisableSearchBoxSuggestions',
        1
      ),
      dword('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search', 'BingSearchEnabled', 0)
    ]
  },
  {
    id: 'suggestedApps',
    group: 'ads',
    values: [
      'SystemPaneSuggestionsEnabled',
      'SubscribedContent-338388Enabled',
      'SilentInstalledAppsEnabled',
      'PreInstalledAppsEnabled',
      'OemPreInstalledAppsEnabled'
    ].map(cdm)
  },
  {
    id: 'startRecommendations',
    group: 'ads',
    explorer: true,
    values: [
      dword(
        'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
        'Start_IrisRecommendations',
        0
      )
    ]
  },
  {
    id: 'tips',
    group: 'ads',
    values: [
      ...[
        'SubscribedContent-338389Enabled',
        'SubscribedContent-310093Enabled',
        'SubscribedContent-338393Enabled',
        'SubscribedContent-353694Enabled',
        'SubscribedContent-353696Enabled',
        'SoftLandingEnabled'
      ].map(cdm),
      dword(
        'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\UserProfileEngagement',
        'ScoobeSystemSettingEnabled',
        0
      )
    ]
  },
  {
    id: 'lockScreen',
    group: 'ads',
    values: ['RotatingLockScreenOverlayEnabled', 'SubscribedContent-338387Enabled'].map(cdm)
  },
  {
    id: 'recall',
    group: 'ai',
    values: [
      dword('HKCU:\\Software\\Policies\\Microsoft\\Windows\\WindowsAI', 'DisableAIDataAnalysis', 1)
    ]
  }
]

const SETTINGS_BY_ID = Object.fromEntries(PRIVACY_SETTINGS.map((s) => [s.id, s]))
// Policies, even the current user's, can only be written with admin rights
const needsAdmin = (setting) =>
  setting.values.some((v) => v.path.startsWith('HKLM:') || v.path.includes('\\Policies\\'))

const psString = (value) => `'${String(value).replace(/'/g, "''")}'`
const psValue = (v, value) => (v.type === 'String' ? psString(value) : String(Number(value)))

function requireWindows() {
  if (!isWindows) throw new Error('Only available on Windows')
}

/** Every setting with whether its feature is on, and whether it needs admin rights. */
export async function getPrivacySettings() {
  requireWindows()
  const all = PRIVACY_SETTINGS.flatMap((s) => s.values)
  const reads = all
    .map(
      (v) =>
        `$v = (Get-ItemProperty -Path ${psString(v.path)} -Name ${psString(v.name)} -ErrorAction SilentlyContinue).${psString(v.name)}; $out += $(if ($null -eq $v) { '<none>' } else { [string]$v })`
    )
    .join('\n')
  const script = `$out = @()\n${reads}\nConvertTo-Json -InputObject @($out) -Compress`
  const values = JSON.parse(await runPowerShell(script, 20e3))

  let index = 0
  return PRIVACY_SETTINGS.map((setting) => {
    const offCount = setting.values.filter((v) => {
      const current = values[index++]
      return current !== '<none>' && String(current) === String(v.off)
    }).length
    return {
      id: setting.id,
      group: setting.group,
      // The feature counts as off only when every value is set
      on: offCount < setting.values.length,
      partly: offCount > 0 && offCount < setting.values.length,
      admin: needsAdmin(setting),
      explorer: Boolean(setting.explorer)
    }
  })
}

function scriptFor(changes) {
  const lines = [
    `function Set-Value($path, $name, $type, $value) {
    if (-not (Test-Path -Path $path)) { New-Item -Path $path -Force | Out-Null }
    New-ItemProperty -Path $path -Name $name -PropertyType $type -Value $value -Force | Out-Null
}
function Remove-Value($path, $name) {
    if (Test-Path -Path $path) { Remove-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue }
}`
  ]
  for (const { setting, on } of changes) {
    for (const v of setting.values) {
      const value = on ? v.restore : v.off
      lines.push(
        value === null
          ? `Remove-Value ${psString(v.path)} ${psString(v.name)}`
          : `Set-Value ${psString(v.path)} ${psString(v.name)} ${psString(v.type)} ${psValue(v, value)}`
      )
    }
  }
  lines.push("'done'")
  return lines.join('\n')
}

/**
 * Turns features on or off: [{ id, on }]. The ones that need admin rights go
 * together, so Windows asks once.
 */
export async function setPrivacySettings(requested) {
  requireWindows()
  if (!Array.isArray(requested) || requested.length === 0) throw new Error('Nothing to change')
  const changes = requested.map(({ id, on }) => {
    const setting = SETTINGS_BY_ID[id]
    if (!setting || typeof on !== 'boolean') throw new Error(`Unknown privacy setting: ${id}`)
    return { setting, on }
  })
  const label = changes.map((c) => `${c.setting.id}=${c.on ? 'on' : 'off'}`).join(', ')
  const user = changes.filter((c) => !needsAdmin(c.setting))
  const admin = changes.filter((c) => needsAdmin(c.setting))

  const results = []
  if (user.length)
    results.push(await runActionScript(scriptFor(user), { label: `Privacy: ${label}` }))
  if (admin.length)
    results.push(
      await runActionScript(scriptFor(admin), { admin: true, label: `Privacy: ${label}` })
    )
  const failed = results.find((r) => !r.ok)
  return failed ?? { ok: true }
}

/** Restarts File Explorer, so Start and search pick up the new settings. */
export async function restartExplorer() {
  requireWindows()
  return runActionScript(
    `Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 1500
if (-not (Get-Process -Name explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
'done'`,
    { label: 'Restarting File Explorer' }
  )
}
