// Reads just enough of a driver INF to compare it with installed drivers:
// its version/date and the hardware IDs it installs on for this CPU
// architecture. No Electron or Windows APIs, so it can be tested anywhere.

// Model-section decorations that apply to each architecture. On 64-bit
// Windows undecorated sections are ignored, which also skips old XP drivers.
const ARCH_DECORATIONS = {
  x64: ['ntamd64'],
  arm64: ['ntarm64'],
  ia32: ['ntx86', 'nt', '']
}

function decodeInf(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.toString('utf16le', 2)
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString('utf8', 3)
  }
  // UTF-16 without a BOM: every other byte of the ASCII text is zero
  if (buffer.length > 1 && buffer[1] === 0 && buffer[3] === 0) return buffer.toString('utf16le')
  return buffer.toString('latin1')
}

// Strips a ';' comment that isn't inside double quotes
function stripComment(line) {
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes
    else if (line[i] === ';' && !inQuotes) return line.slice(0, i)
  }
  return line
}

function parseSections(text) {
  const sections = new Map()
  let current = null
  let pending = ''
  for (const rawLine of text.split(/\r?\n/)) {
    let line = pending + stripComment(rawLine).trim()
    pending = ''
    // A trailing backslash continues the line
    if (line.endsWith('\\')) {
      pending = line.slice(0, -1)
      continue
    }
    if (!line) continue
    const header = /^\[([^\]]+)\]$/.exec(line)
    if (header) {
      current = header[1].trim().toLowerCase()
      if (!sections.has(current)) sections.set(current, [])
    } else if (current) {
      sections.get(current).push(line)
    }
  }
  return sections
}

function splitList(value) {
  return value.split(',').map((part) => part.trim().replace(/^"|"$/g, ''))
}

function resolveStrings(value, strings) {
  return value.replace(/%([^%]+)%/g, (match, key) => strings.get(key.toLowerCase()) ?? match)
}

/** "1.2.3.4" → [1, 2, 3, 4]; anything unparsable → null. */
export function parseVersion(version) {
  if (!version) return null
  const parts = String(version).trim().split('.').map(Number)
  return parts.every(Number.isFinite) ? parts : null
}

/** <0 if a is older than b, 0 if equal, >0 if newer; null if not comparable. */
export function compareVersions(a, b) {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (!va || !vb) return null
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const diff = (va[i] ?? 0) - (vb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// "mm/dd/yyyy" → "yyyy-mm-dd"
function normalizeInfDate(date) {
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(date?.trim() ?? '')
  if (!match) return null
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

function appliesToArch(decoration, arch) {
  const allowed = ARCH_DECORATIONS[arch] ?? ARCH_DECORATIONS.x64
  // "NTamd64.10.0...16299" → "ntamd64"
  const platform = decoration.toLowerCase().split('.')[0]
  return allowed.includes(platform)
}

/**
 * Parses an INF file's contents. Returns null for INFs that install no
 * devices on this architecture.
 */
export function parseInf(buffer, arch = 'x64') {
  const sections = parseSections(decodeInf(buffer))
  const strings = new Map()
  for (const [name, lines] of sections) {
    if (!name.startsWith('strings')) continue
    for (const line of lines) {
      const eq = line.indexOf('=')
      if (eq > 0) {
        const key = line.slice(0, eq).trim().toLowerCase()
        if (!strings.has(key))
          strings.set(
            key,
            line
              .slice(eq + 1)
              .trim()
              .replace(/^"|"$/g, '')
          )
      }
    }
  }
  const version = new Map()
  for (const line of sections.get('version') ?? []) {
    const eq = line.indexOf('=')
    if (eq > 0) version.set(line.slice(0, eq).trim().toLowerCase(), line.slice(eq + 1).trim())
  }
  const [date, driverVersion] = splitList(resolveStrings(version.get('driverver') ?? '', strings))

  // [Manufacturer]: %Mfg% = ModelsSection, NTamd64, NTamd64.10.0
  const modelSections = []
  for (const line of sections.get('manufacturer') ?? []) {
    const eq = line.indexOf('=')
    const [base, ...decorations] = splitList(eq >= 0 ? line.slice(eq + 1) : line)
    if (!base) continue
    if (decorations.length === 0) {
      if (appliesToArch('', arch)) modelSections.push(base.toLowerCase())
    } else {
      for (const decoration of decorations) {
        if (appliesToArch(decoration, arch)) {
          modelSections.push(`${base}.${decoration}`.toLowerCase())
        }
      }
    }
  }

  // Models: %DeviceDesc% = InstallSection, HardwareId [, CompatibleId...]
  const ids = new Set()
  let description = null
  for (const sectionName of modelSections) {
    for (const line of sections.get(sectionName) ?? []) {
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const [, ...deviceIds] = splitList(line.slice(eq + 1))
      for (const id of deviceIds) {
        if (id && id.includes('\\')) ids.add(resolveStrings(id, strings).toUpperCase())
      }
      description ??=
        resolveStrings(line.slice(0, eq).trim(), strings).replace(/^"|"$/g, '') || null
    }
  }
  if (ids.size === 0) return null
  return {
    version: driverVersion || null,
    date: normalizeInfDate(date),
    description,
    provider: resolveStrings(version.get('provider') ?? '', strings).replace(/^"|"$/g, '') || null,
    driverClass: version.get('class') ?? null,
    ids: [...ids]
  }
}
