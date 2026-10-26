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

const WINRT_AWAIT_PRELUDE = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Windows.Forms
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    while (-not $netTask.AsyncWaitHandle.WaitOne(15)) {
        [System.Windows.Forms.Application]::DoEvents()
    }
    $netTask.GetAwaiter().GetResult()
}
`.trim()
async function runPowerShellScript(script, timeoutMs) {
  const scriptPath = path.join(os.tmpdir(), `windiag-${randomUUID()}.ps1`)
  try {
    await writeFile(scriptPath, script, 'utf-8')
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Sta -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { windowsHide: true, timeout: timeoutMs }
    )
    return stdout.trim()
  } finally {
    await unlink(scriptPath).catch(() => void 0)
  }
}

function coerceArray(value) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

async function queryPnpEntities(whereClause) {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { ${whereClause} } | Select-Object Name, PNPDeviceID, PNPClass | ConvertTo-Json -Compress"`,
      { windowsHide: true, timeout: 5e3 }
    )
    const trimmed = stdout.trim()
    if (!trimmed) return []
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

async function detectSmartCardReaders() {
  const rows = await queryPnpEntities(
    "$_.PNPClass -eq 'SmartCardReader' -and $_.ConfigManagerErrorCode -eq 0"
  )
  const readers = []
  const seen = new Set()
  for (const row of rows) {
    const name = cleanString(row.Name)
    const id = cleanString(row.PNPDeviceID)
    if (!name || !id || seen.has(id)) continue
    seen.add(id)
    readers.push({ id, name })
  }
  return readers
}

const GPS_NAME_PATTERN = /\b(gps|gnss)\b/i
async function detectGpsSensors() {
  const rows = await queryPnpEntities(
    "($_.PNPClass -eq 'Sensor' -or $_.PNPClass -eq 'SensorDevice') -and $_.ConfigManagerErrorCode -eq 0"
  )
  const sensors = []
  const seen = new Set()
  for (const row of rows) {
    const name = cleanString(row.Name)
    const id = cleanString(row.PNPDeviceID)
    if (!name || !id || seen.has(id)) continue
    if (!GPS_NAME_PATTERN.test(name)) continue
    seen.add(id)
    sensors.push({ id, name })
  }
  return sensors
}

const BARCODE_VENDOR_PATTERNS = [
  'honeywell',
  'zebra',
  'symbol',
  'motorola solutions',
  'datalogic',
  'metrologic',
  'socket mobile',
  'newland',
  'opticon',
  'cipherlab',
  'unitech',
  'intermec',
  'wasp',
  'barcode',
  'scanner',
  'pos-x',
  'posx'
]

async function detectBarcodeScannerCandidates() {
  const rows = await queryPnpEntities(
    "($_.PNPClass -eq 'Keyboard' -or $_.PNPClass -eq 'HIDClass') -and $_.ConfigManagerErrorCode -eq 0"
  )
  const devices = []
  const seen = new Set()
  for (const row of rows) {
    const name = cleanString(row.Name)
    const id = cleanString(row.PNPDeviceID)
    if (!name || !id || seen.has(id)) continue
    const lower = name.toLowerCase()
    if (!BARCODE_VENDOR_PATTERNS.some((pattern) => lower.includes(pattern))) continue
    seen.add(id)
    devices.push({ id, name })
  }
  return devices
}

const RADIOS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
    ${WINRT_AWAIT_PRELUDE}

    [Windows.Devices.Radios.Radio,Windows.Devices.Radios,ContentType=WindowsRuntime] | Out-Null

    $radios = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])

    $result = @()
    foreach ($radio in $radios) {
        $result += [PSCustomObject]@{ name = $radio.Name; kind = $radio.Kind.ToString(); state = $radio.State.ToString() }
    }

    $result | ConvertTo-Json -Compress
} catch {
    ''
}
`.trim()
function mapRadioKind(raw) {
  switch (raw) {
    case 'WiFi':
      return 'wifi'
    case 'Bluetooth':
      return 'bluetooth'
    case 'MobileBroadband':
      return 'cellular'
    default:
      return null
  }
}

function mapRadioState(raw) {
  switch (raw) {
    case 'On':
      return 'on'
    case 'Off':
      return 'off'
    case 'Disabled':
      return 'disabled'
    default:
      return 'unknown'
  }
}

async function detectRadios() {
  try {
    const stdout = await runPowerShellScript(RADIOS_SCRIPT, 8e3)
    if (!stdout) return []
    const parsed = JSON.parse(stdout)
    const rows = coerceArray(parsed)
    const radios = []
    for (const row of rows) {
      const name = cleanString(row.name)
      const kind = mapRadioKind(row.kind)
      if (!name || !kind) continue
      radios.push({ name, kind, state: mapRadioState(row.state) })
    }
    return radios
  } catch {
    return []
  }
}

export async function getOtherDevicesSnapshot() {
  const [smartCardReaders, gpsSensors, barcodeScannerCandidates, radios] = await Promise.all([
    detectSmartCardReaders(),
    detectGpsSensors(),
    detectBarcodeScannerCandidates(),
    detectRadios()
  ])
  return { smartCardReaders, gpsSensors, barcodeScannerCandidates, radios }
}

const SMARTCARD_STATUS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
    ${WINRT_AWAIT_PRELUDE}

    [Windows.Devices.SmartCards.SmartCardReader,Windows.Devices.SmartCards,ContentType=WindowsRuntime] | Out-Null

    $readers = Await ([Windows.Devices.SmartCards.SmartCardReader]::FindAllReadersAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.SmartCards.SmartCardReader]])

    $result = @()
    foreach ($reader in $readers) {
        $cards = Await ($reader.FindAllCardsAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.SmartCards.SmartCard]])
        $result += [PSCustomObject]@{ name = $reader.Name; cardPresent = ([bool]($cards.Count -gt 0)) }
    }

    @{ readers = @($result); error = $null } | ConvertTo-Json -Compress -Depth 4
} catch {
    @{ readers = @(); error = $_.Exception.Message } | ConvertTo-Json -Compress
}
`.trim()
export async function getSmartCardStatus() {
  try {
    const stdout = await runPowerShellScript(SMARTCARD_STATUS_SCRIPT, 1e4)
    if (!stdout) return { readers: [], error: 'The system did not return a response.' }
    const parsed = JSON.parse(stdout)
    const readers = coerceArray(parsed.readers)
      .map((row) => row)
      .filter((row) => cleanString(row.name))
      .map((row) => ({
        name: cleanString(row.name),
        cardPresent: Boolean(row.cardPresent)
      }))
    return { readers, error: parsed.error ?? null }
  } catch (err) {
    return { readers: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

const GPS_FIX_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
    ${WINRT_AWAIT_PRELUDE}

    [Windows.Devices.Geolocation.Geolocator,Windows.Devices.Geolocation,ContentType=WindowsRuntime] | Out-Null
    [Windows.Devices.Geolocation.PositionAccuracy,Windows.Devices.Geolocation,ContentType=WindowsRuntime] | Out-Null

    $geolocator = New-Object Windows.Devices.Geolocation.Geolocator
    $geolocator.DesiredAccuracy = [Windows.Devices.Geolocation.PositionAccuracy]::High

    $position = Await ($geolocator.GetGeopositionAsync()) ([Windows.Devices.Geolocation.Geoposition])
    $coord = $position.Coordinate

    @{
        latitude = $coord.Point.Position.Latitude
        longitude = $coord.Point.Position.Longitude
        accuracyMeters = $coord.Accuracy
        altitudeMeters = $coord.Point.Position.Altitude
        source = $coord.PositionSource.ToString()
        timestamp = $coord.Timestamp.ToString('o')
        error = $null
    } | ConvertTo-Json -Compress
} catch {
    @{ latitude = $null; longitude = $null; accuracyMeters = $null; altitudeMeters = $null; source = $null; timestamp = $null; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
`.trim()
const EMPTY_GPS_FIX = {
  latitude: null,
  longitude: null,
  accuracyMeters: null,
  altitudeMeters: null,
  source: null,
  timestamp: null,
  error: null
}

export async function getGpsFix() {
  try {
    const stdout = await runPowerShellScript(GPS_FIX_SCRIPT, 2e4)
    if (!stdout) {
      return { ...EMPTY_GPS_FIX, error: 'The system did not return a response.' }
    }
    return { ...EMPTY_GPS_FIX, ...JSON.parse(stdout) }
  } catch (err) {
    return { ...EMPTY_GPS_FIX, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

async function queryWifiConnection() {
  try {
    const { stdout } = await execAsync('netsh wlan show interfaces', {
      windowsHide: true,
      timeout: 5e3
    })
    const stateMatch = /^\s*State\s*:\s*(.+)$/im.exec(stdout)
    const state = stateMatch ? stateMatch[1].trim().toLowerCase() : ''
    if (state !== 'connected') {
      return { connected: false, ssid: null, signalPercent: null, error: null }
    }
    const ssidMatch = /^\s*SSID\s*:\s*(.+)$/im.exec(stdout)
    const signalMatch = /^\s*Signal\s*:\s*(\d+)\s*%/im.exec(stdout)
    return {
      connected: true,
      ssid: cleanString(ssidMatch?.[1]),
      signalPercent: signalMatch ? Number(signalMatch[1]) : null,
      error: null
    }
  } catch (err) {
    return {
      connected: false,
      ssid: null,
      signalPercent: null,
      error: err instanceof Error ? err.message : 'Unknown error'
    }
  }
}

export async function getWifiConnectionStatus() {
  return queryWifiConnection()
}
