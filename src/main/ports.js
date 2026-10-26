import si from 'systeminformation'
import { parseJsonArray, runPowerShell } from './powershell'

const cleanString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// Hubs and composite-device parents are identified by their driver service,
// which is the same on every Windows display language (their names are
// translated, e.g. "Hub genérico USB" on Spanish Windows).
const USB_NOISE_SERVICES = new Set(['usbhub', 'usbhub3', 'usbccgp'])
const USB_NOISE_PATTERNS = [
  'root hub',
  'generic usb hub',
  'usb composite device',
  'usb input device'
]

function isNoiseDevice(name, id, service) {
  if (id.toUpperCase().startsWith('USB\\ROOT_HUB')) return true
  if (service && USB_NOISE_SERVICES.has(service.toLowerCase())) return true
  const lower = name.toLowerCase()
  return USB_NOISE_PATTERNS.some((pattern) => lower.includes(pattern))
}

const RADIO_ADAPTER_CLASSES = new Set(['bluetooth', 'net', 'modem', 'nettether'])
function isRadioAdapterDevice(pnpClass) {
  return pnpClass !== null && RADIO_ADAPTER_CLASSES.has(pnpClass.toLowerCase())
}

async function queryUsbDevices() {
  try {
    // -Filter runs server-side in WMI, much faster than piping every PnP
    // device through Where-Object.
    const rows = parseJsonArray(
      await runPowerShell(
        `Get-CimInstance -ClassName Win32_PnPEntity -Filter "PNPDeviceID LIKE 'USB%' AND ConfigManagerErrorCode = 0" | Select-Object Name, PNPDeviceID, Manufacturer, PNPClass, Service | ConvertTo-Json -Compress`
      )
    )
    const devices = []
    const seen = new Set()
    for (const row of rows) {
      const r = row
      const name = cleanString(r.Name)
      const id = cleanString(r.PNPDeviceID)
      const type = cleanString(r.PNPClass)
      if (!name || !id) continue
      if (isNoiseDevice(name, id, cleanString(r.Service))) continue
      if (isRadioAdapterDevice(type)) continue
      if (seen.has(id)) continue
      seen.add(id)
      devices.push({
        id,
        name,
        manufacturer: cleanString(r.Manufacturer),
        type
      })
    }
    return devices
  } catch {
    return []
  }
}

async function queryEthernetPorts() {
  try {
    const interfaces = await si.networkInterfaces()
    const list = Array.isArray(interfaces) ? interfaces : [interfaces]
    return list
      .filter((iface) => iface.type === 'wired' && !iface.virtual && !iface.internal)
      .map((iface) => ({
        id: iface.iface,
        name: cleanString(iface.ifaceName) ?? cleanString(iface.iface) ?? 'Network port',
        connected: iface.operstate === 'up',
        speedMbps: typeof iface.speed === 'number' && iface.speed > 0 ? iface.speed : null,
        macAddress: cleanString(iface.mac)
      }))
  } catch {
    return []
  }
}

export async function getPortsSnapshot() {
  const [usbDevices, ethernet] = await Promise.all([queryUsbDevices(), queryEthernetPorts()])
  return { usbDevices, ethernet }
}
