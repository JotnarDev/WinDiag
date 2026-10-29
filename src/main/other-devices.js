import { parseJsonArray, runPowerShell, runPowerShellIsolated } from './powershell'

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
function coerceArray(value) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

// Every detector below looks at the same few PnP classes, so they share one
// WMI query (filtered server-side) instead of each enumerating all devices.
const DETECTED_PNP_CLASSES = [
  'SmartCardReader',
  'Sensor',
  'SensorDevice',
  'Keyboard',
  'HIDClass',
  'Bluetooth'
]

async function queryPnpEntities() {
  const classFilter = DETECTED_PNP_CLASSES.map((c) => `PNPClass = '${c}'`).join(' OR ')
  try {
    return parseJsonArray(
      await runPowerShell(
        `Get-CimInstance -ClassName Win32_PnPEntity -Filter "ConfigManagerErrorCode = 0 AND (${classFilter})" | Select-Object Name, PNPDeviceID, PNPClass | ConvertTo-Json -Compress`
      )
    )
  } catch {
    return []
  }
}

const ofClass = (rows, ...classes) => rows.filter((row) => classes.includes(row.PNPClass))

function detectSmartCardReaders(pnpRows) {
  const rows = ofClass(pnpRows, 'SmartCardReader')
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
function detectGpsSensors(pnpRows) {
  const rows = ofClass(pnpRows, 'Sensor', 'SensorDevice')
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

function detectBarcodeScannerCandidates(pnpRows) {
  const rows = ofClass(pnpRows, 'Keyboard', 'HIDClass')
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
    const stdout = await runPowerShellIsolated(RADIOS_SCRIPT, 8e3)
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

// The Bluetooth radio itself sits on a bus (USB, PCI, or UART via ACPI);
// paired devices and the enumerators under it (BTHENUM\, BTHLE\, BTH\…) don't.
const BLUETOOTH_RADIO_ID = /^(USB|PCI|ACPI)\\/i

function detectBluetoothAdapterName(pnpRows) {
  const radio = ofClass(pnpRows, 'Bluetooth').find((row) =>
    BLUETOOTH_RADIO_ID.test(row.PNPDeviceID ?? '')
  )
  return cleanString(radio?.Name)
}

// Hardware names of the Wi-Fi and mobile broadband adapters (e.g. "Sierra
// Wireless EM7455 Qualcomm Snapdragon X7 LTE-A"). The radio list above only
// has generic names like "Cellular".
const NETWORK_ADAPTERS_SCRIPT = `
Get-NetAdapter -Physical -ErrorAction SilentlyContinue |
    Where-Object { $_.NdisPhysicalMedium -in 8, 9 } |
    ForEach-Object { [PSCustomObject]@{ medium = [int]$_.NdisPhysicalMedium; name = $_.InterfaceDescription } } |
    ConvertTo-Json -Compress
`.trim()

// NDIS_PHYSICAL_MEDIUM: 8 = wireless WAN (4G/5G modem), 9 = native 802.11
async function queryNetworkAdapterNames() {
  try {
    const rows = parseJsonArray(await runPowerShell(NETWORK_ADAPTERS_SCRIPT))
    const nameOf = (medium) => cleanString(rows.find((row) => row.medium === medium)?.name)
    return { wifi: nameOf(9), cellular: nameOf(8) }
  } catch {
    return { wifi: null, cellular: null }
  }
}

export async function getOtherDevicesSnapshot() {
  const [pnpRows, radios, networkAdapters] = await Promise.all([
    queryPnpEntities(),
    detectRadios(),
    queryNetworkAdapterNames()
  ])
  return {
    adapterNames: {
      wifi: networkAdapters.wifi,
      bluetooth: detectBluetoothAdapterName(pnpRows),
      cellular: networkAdapters.cellular
    },
    smartCardReaders: detectSmartCardReaders(pnpRows),
    gpsSensors: detectGpsSensors(pnpRows),
    barcodeScannerCandidates: detectBarcodeScannerCandidates(pnpRows),
    radios
  }
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
    const stdout = await runPowerShellIsolated(SMARTCARD_STATUS_SCRIPT, 1e4)
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
    const stdout = await runPowerShellIsolated(GPS_FIX_SCRIPT, 2e4)
    if (!stdout) {
      return { ...EMPTY_GPS_FIX, error: 'The system did not return a response.' }
    }
    return { ...EMPTY_GPS_FIX, ...JSON.parse(stdout) }
  } catch (err) {
    return { ...EMPTY_GPS_FIX, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Locale-independent: the adapter state comes from Get-NetAdapter (an enum,
// not translated text) and the signal is the only "NN%" value netsh prints.
// The old parser looked for the English "State"/"Signal" labels, so Wi-Fi
// always showed as disconnected on non-English Windows.
const WIFI_STATUS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
    # NdisPhysicalMedium 9 = native 802.11 (Wi-Fi)
    $adapter = Get-NetAdapter -Physical -ErrorAction SilentlyContinue |
        Where-Object { $_.NdisPhysicalMedium -eq 9 } |
        Sort-Object { $_.Status -ne 'Up' } |
        Select-Object -First 1
    $connected = [bool]($adapter -and $adapter.Status -eq 'Up')
    $ssid = $null
    $signal = $null
    if ($connected) {
        # netsh writes in the console's OEM code page
        $previous = [Console]::OutputEncoding
        [Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding([Globalization.CultureInfo]::CurrentCulture.TextInfo.OEMCodePage)
        try { $text = (netsh wlan show interfaces) -join "\`n" } finally { [Console]::OutputEncoding = $previous }
        if ($text -match '(?m)^\\s*SSID\\s*:\\s*(.+?)\\s*$') { $ssid = $Matches[1] }
        if ($text -match ':\\s*(\\d{1,3})\\s*%') { $signal = [int]$Matches[1] }
    }
    @{ connected = $connected; ssid = $ssid; signalPercent = $signal; error = $null } | ConvertTo-Json -Compress
} catch {
    @{ connected = $false; ssid = $null; signalPercent = $null; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
`.trim()

async function queryWifiConnection() {
  try {
    const raw = JSON.parse(await runPowerShell(WIFI_STATUS_SCRIPT, 10e3))
    return {
      connected: Boolean(raw.connected),
      ssid: cleanString(raw.ssid),
      signalPercent: typeof raw.signalPercent === 'number' ? raw.signalPercent : null,
      error: raw.error ?? null
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
