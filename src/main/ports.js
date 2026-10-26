import { exec } from 'child_process'
import { promisify } from 'util'
import si from 'systeminformation'

const execAsync = promisify(exec)
const cleanString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const USB_NOISE_PATTERNS = [
  'root hub',
  'generic usb hub',
  'usb composite device',
  'usb input device',
  'host controller',
  'hub genérico usb',
  'concentrador raíz'
]

function isNoiseDevice(name) {
  const lower = name.toLowerCase()
  return USB_NOISE_PATTERNS.some((pattern) => lower.includes(pattern))
}

const RADIO_ADAPTER_CLASSES = new Set(['bluetooth', 'net', 'modem', 'nettether'])
function isRadioAdapterDevice(pnpClass) {
  return pnpClass !== null && RADIO_ADAPTER_CLASSES.has(pnpClass.toLowerCase())
}

async function queryUsbDevices() {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { $_.PNPDeviceID -like 'USB*' -and $_.ConfigManagerErrorCode -eq 0 } | Select-Object Name, PNPDeviceID, Manufacturer, PNPClass | ConvertTo-Json -Compress"`,
      // 4s timeout, safely under the 5s poll interval below (with the
      // renderer's overlap guard, this is belt-and-suspenders: it just
      // makes sure a single slow call can't stall the next cycle for long).
      { windowsHide: true, timeout: 4e3 }
    )
    const trimmed = stdout.trim()
    if (!trimmed) return []
    const parsed = JSON.parse(trimmed)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    const devices = []
    const seen = new Set()
    for (const row of rows) {
      const r = row
      const name = cleanString(r.Name)
      const id = cleanString(r.PNPDeviceID)
      const type = cleanString(r.PNPClass)
      if (!name || !id) continue
      if (isNoiseDevice(name)) continue
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
        name: cleanString(iface.ifaceName) ?? cleanString(iface.iface) ?? 'Puerto de red',
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
