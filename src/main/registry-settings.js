import { runPowerShell } from './powershell'
import { runActionScript } from './elevated'

/*
 * Windows settings that live in the registry, as a set of options. Each
 * option lists the exact values it writes:
 *
 *   { path, name, type: 'DWord' | 'String', value, orAbsent }
 *     value null    → the value is removed
 *     orAbsent      → a missing value also counts as this option (Windows'
 *                     default when nothing has been written)
 *     alsoMatches   → other values that count as this option when read
 *   { path, type: 'Key', value: true | false }
 *     the key exists or not (removed with everything under it)
 *
 * A setting may add `apply(option)`, PowerShell run after writing so the
 * change shows at once. Settings under HKLM, HKEY_USERS or a Policies key
 * need admin rights; those values are written together, with one UAC
 * prompt, and the rest as the user.
 */

const isWindows = process.platform === 'win32'

export function requireWindows() {
  if (!isWindows) throw new Error('Only available on Windows')
}

export const psString = (value) => `'${String(value).replace(/'/g, "''")}'`

const specNeedsAdmin = (v) =>
  v.path.startsWith('HKLM:') ||
  v.path.startsWith('Registry::HKEY_USERS') ||
  v.path.includes('\\Policies\\')

export const needsAdmin = (setting) => Object.values(setting.options).flat().some(specNeedsAdmin)

const MISSING = '<none>'

function readExpression(spec) {
  if (spec.type === 'Key')
    return `$(if (Test-Path -LiteralPath ${psString(spec.path)}) { 'True' } else { 'False' })`
  return `$(
    $v = (Get-ItemProperty -LiteralPath ${psString(spec.path)} -Name ${psString(spec.name)} -ErrorAction SilentlyContinue).${psString(spec.name)}
    if ($null -eq $v) { '${MISSING}' } else { [string]$v }
)`
}

function matches(spec, current) {
  if (spec.type === 'Key') return current === String(Boolean(spec.value) ? 'True' : 'False')
  if (current === MISSING) return spec.value === null || Boolean(spec.orAbsent)
  if (spec.value === null) return false
  return [spec.value, ...(spec.alsoMatches ?? [])].some((v) => String(current) === String(v))
}

/** The option each setting is on now (null when it matches none). */
export async function readSettings(settings) {
  requireWindows()
  // Every distinct value is read once
  const specs = []
  const key = (s) => `${s.type === 'Key' ? 'key' : 'value'}|${s.path}|${s.name ?? ''}`
  const seen = new Map()
  for (const setting of settings)
    for (const option of Object.values(setting.options))
      for (const spec of option)
        if (!seen.has(key(spec))) {
          seen.set(key(spec), specs.length)
          specs.push(spec)
        }
  const script = `$out = @()\n${specs.map((s) => `$out += ${readExpression(s)}`).join('\n')}\nConvertTo-Json -InputObject @($out) -Compress`
  const raw = JSON.parse(await runPowerShell(script, 20e3))
  const values = Array.isArray(raw) ? raw : [raw]

  return settings.map((setting) => {
    const option =
      Object.entries(setting.options).find(([, specsOfOption]) =>
        specsOfOption.every((spec) => matches(spec, values[seen.get(key(spec))]))
      )?.[0] ?? null
    return { id: setting.id, option }
  })
}

const HELPERS = `function Set-Value($path, $name, $type, $value) {
    if (-not (Test-Path -LiteralPath $path)) { New-Item -Path $path -Force | Out-Null }
    New-ItemProperty -LiteralPath $path -Name $name -PropertyType $type -Value $value -Force | Out-Null
}
function Remove-Value($path, $name) {
    if (Test-Path -LiteralPath $path) { Remove-ItemProperty -LiteralPath $path -Name $name -ErrorAction SilentlyContinue }
}
function Set-Key($path, $present) {
    if ($present) {
        if (-not (Test-Path -LiteralPath $path)) { New-Item -Path $path -Force | Out-Null }
        Set-Item -LiteralPath $path -Value '' -Force
    } elseif (Test-Path -LiteralPath $path) {
        Remove-Item -LiteralPath $path -Recurse -Force
    }
}`

function writeLine(spec) {
  if (spec.type === 'Key') return `Set-Key ${psString(spec.path)} $${Boolean(spec.value)}`
  if (spec.value === null) return `Remove-Value ${psString(spec.path)} ${psString(spec.name)}`
  const value = spec.type === 'String' ? psString(spec.value) : String(Number(spec.value))
  return `Set-Value ${psString(spec.path)} ${psString(spec.name)} ${psString(spec.type)} ${value}`
}

function scriptFor(lines) {
  return [HELPERS, ...lines, "'done'"].join('\n')
}

/**
 * Sets settings to the given options: [{ id, option }]. Returns
 * { ok: true } or the first failure ({ ok: false, error | cancelled }).
 */
export async function writeSettings(settings, requested, labelPrefix) {
  requireWindows()
  const byId = Object.fromEntries(settings.map((s) => [s.id, s]))
  if (!Array.isArray(requested) || requested.length === 0) throw new Error('Nothing to change')
  const changes = requested.map(({ id, option }) => {
    const setting = byId[id]
    if (!setting || !Object.hasOwn(setting.options, option))
      throw new Error(`Unknown setting: ${id}=${option}`)
    return { setting, option }
  })
  const label = `${labelPrefix}: ${changes.map((c) => `${c.setting.id}=${c.option}`).join(', ')}`
  // The current user's values are written as the user, even for a setting
  // that also has admin values: an elevated process may run as another
  // account, with its own HKCU. Apply steps act on the user's session.
  const user = []
  const admin = []
  for (const { setting, option } of changes) {
    for (const spec of setting.options[option])
      (specNeedsAdmin(spec) ? admin : user).push(writeLine(spec))
    if (setting.apply) user.push(setting.apply(option))
  }

  const results = []
  if (user.length) results.push(await runActionScript(scriptFor(user), { label }))
  if (admin.length) results.push(await runActionScript(scriptFor(admin), { admin: true, label }))
  return results.find((r) => !r.ok) ?? { ok: true }
}
