import os from 'os'
import si from 'systeminformation'
import { parseJsonArray, runPowerShell } from './powershell'

const bytesToGB = (bytes) => Math.round((bytes / 1024 ** 3) * 10) / 10
const positiveOrNull = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
const bytesToKBOrNull = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value / 1024) : null
const cleanString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const DEVICE_PLACEHOLDER_PATTERNS = [
  'to be filled',
  'system manufacturer',
  'system product name',
  'system serial number',
  'system version',
  'default string',
  'not applicable',
  'o.e.m',
  'not specified',
  'unknown'
]

const sanitizeDeviceField = (value) => {
  const cleaned = cleanString(value)
  if (!cleaned) return null
  const lower = cleaned.toLowerCase()
  return DEVICE_PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern)) ? null : cleaned
}

async function buildDeviceInfo() {
  const sys = await si.system()
  return {
    manufacturer: sanitizeDeviceField(sys.manufacturer),
    model: sanitizeDeviceField(sys.model),
    serialNumber: sanitizeDeviceField(sys.serial)
  }
}

async function buildBiosInfo() {
  const biosData = await si.bios()
  return {
    vendor: sanitizeDeviceField(biosData.vendor),
    version: cleanString(biosData.version),
    releaseDate: cleanString(biosData.releaseDate)
  }
}

const WINDOWS_LICENSING_APP_ID = '55c92734-d682-4d71-983e-d6ec3f16059f'
async function queryWindowsActivation() {
  try {
    const trimmed = await runPowerShell(
      `Get-CimInstance -ClassName SoftwareLicensingProduct | Where-Object { $_.PartialProductKey -and $_.ApplicationId -eq '${WINDOWS_LICENSING_APP_ID}' } | Select-Object -ExpandProperty LicenseStatus | ConvertTo-Json -Compress`,
      10e3
    )
    if (!trimmed) return null
    const parsed = JSON.parse(trimmed)
    const statuses = (Array.isArray(parsed) ? parsed : [parsed]).map(Number)
    if (statuses.length === 0) return null
    return statuses.includes(1)
  } catch {
    return null
  }
}

async function buildOsInfo() {
  const [osData, activated] = await Promise.all([si.osInfo(), queryWindowsActivation()])
  return {
    name: cleanString(osData.distro) ?? cleanString(osData.platform),
    version: cleanString(osData.release),
    build: cleanString(osData.build),
    architecture: cleanString(osData.arch),
    activated
  }
}

// Disk usage changes slowly, so the volume list is re-read at most once a minute.
const MAIN_DISK_CACHE_MS = 60e3
let mainDiskCache = null
async function getMainDisk() {
  if (mainDiskCache && Date.now() - mainDiskCache.at < MAIN_DISK_CACHE_MS) {
    return mainDiskCache.disk
  }
  const fsData = await si.fsSize()
  const disk = [...fsData].sort((a, b) => b.size - a.size)[0] ?? null
  mainDiskCache = { at: Date.now(), disk }
  return disk
}

async function buildBatteryInfo() {
  const batteryData = await si.battery()
  const currentCapacityMWh = positiveOrNull(batteryData.currentCapacity)
  const maxCapacityMWh = positiveOrNull(batteryData.maxCapacity)
  const designedCapacityMWh = positiveOrNull(batteryData.designedCapacity)
  const healthPercent =
    maxCapacityMWh && designedCapacityMWh
      ? Math.round((maxCapacityMWh / designedCapacityMWh) * 100)
      : null
  return {
    hasBattery: batteryData.hasBattery,
    isCharging: batteryData.isCharging,
    acConnected: Boolean(batteryData.acConnected),
    percent: batteryData.percent,
    timeRemainingMinutes:
      batteryData.timeRemaining && batteryData.timeRemaining > 0 ? batteryData.timeRemaining : null,
    cycleCount: positiveOrNull(batteryData.cycleCount),
    voltage: positiveOrNull(batteryData.voltage),
    currentCapacityMWh,
    maxCapacityMWh,
    designedCapacityMWh,
    healthPercent,
    manufacturer: batteryData.manufacturer || null,
    model: batteryData.model || null
  }
}

const BATTERY_WMI_PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
    $statics = Get-CimInstance -Namespace root\\WMI -ClassName BatteryStaticData -ErrorAction SilentlyContinue
    $results = @()
    foreach ($s in $statics) {
        $escaped = $s.InstanceName -replace "'", "''"
        $filter = "InstanceName='$escaped'"
        $status = Get-CimInstance -Namespace root\\WMI -ClassName BatteryStatus -Filter $filter -ErrorAction SilentlyContinue
        $full = Get-CimInstance -Namespace root\\WMI -ClassName BatteryFullChargedCapacity -Filter $filter -ErrorAction SilentlyContinue
        $cycle = Get-CimInstance -Namespace root\\WMI -ClassName BatteryCycleCount -Filter $filter -ErrorAction SilentlyContinue

        $results += [PSCustomObject]@{
            InstanceName        = $s.InstanceName
            ManufacturerName    = $s.ManufacturerName
            DesignedCapacity    = $s.DesignedCapacity
            DeviceName          = $s.DeviceName
            FullChargedCapacity = $full.FullChargedCapacity
            RemainingCapacity   = $status.RemainingCapacity
            Voltage             = $status.Voltage
            Charging            = [bool]$status.Charging
            PowerOnline         = [bool]$status.PowerOnline
            CycleCount          = $cycle.CycleCount
        }
    }
    $results | ConvertTo-Json -Compress
} catch {
    ''
}
`.trim()
async function queryBatteriesWmi() {
  try {
    return parseJsonArray(await runPowerShell(BATTERY_WMI_PS_SCRIPT))
  } catch {
    return []
  }
}

// The per-battery breakdown only matters on devices with more than one
// battery. The first reading tells us how many there are; single-battery
// devices (nearly all of them) skip this WMI query on every later poll.
let hasMultipleBatteries = null
async function queryBatteriesIfMultiple() {
  if (hasMultipleBatteries === false) return []
  const batteries = await queryBatteriesWmi()
  if (hasMultipleBatteries === null) hasMultipleBatteries = batteries.length > 1
  return batteries
}

function buildBatteryDeviceInfo(raw, index) {
  const currentCapacityMWh = positiveOrNull(raw.RemainingCapacity)
  const maxCapacityMWh = positiveOrNull(raw.FullChargedCapacity)
  const designedCapacityMWh = positiveOrNull(raw.DesignedCapacity)
  const healthPercent =
    maxCapacityMWh && designedCapacityMWh
      ? Math.round((maxCapacityMWh / designedCapacityMWh) * 100)
      : null
  const percent =
    currentCapacityMWh && maxCapacityMWh
      ? Math.min(100, Math.max(0, Math.round((currentCapacityMWh / maxCapacityMWh) * 100)))
      : 0
  return {
    id: cleanString(raw.InstanceName) ?? `battery-${index}`,
    hasBattery: true,
    isCharging: Boolean(raw.Charging),
    acConnected: Boolean(raw.PowerOnline),
    percent,
    // Per-battery remaining time isn't exposed by these WMI classes — only
    // the system-wide estimate in the combined reading above has that.
    timeRemainingMinutes: null,
    cycleCount: positiveOrNull(raw.CycleCount),
    voltage: positiveOrNull(raw.Voltage),
    currentCapacityMWh,
    maxCapacityMWh,
    designedCapacityMWh,
    healthPercent,
    manufacturer: cleanString(raw.ManufacturerName),
    model: cleanString(raw.DeviceName)
  }
}

export async function getStaticSystemInfo() {
  const [
    deviceInfo,
    biosInfo,
    osData,
    cpuData,
    cacheData,
    memData,
    memModulesData,
    disksData,
    batteryData
  ] = await Promise.all([
    buildDeviceInfo(),
    buildBiosInfo(),
    buildOsInfo(),
    si.cpu(),
    si.cpuCache(),
    si.mem(),
    si.memLayout(),
    si.diskLayout(),
    si.battery()
  ])
  const modules = memModulesData
    .filter((m) => (m.size ?? 0) > 0)
    .map((m) => ({
      bank: cleanString(m.bank),
      capacityGB: bytesToGB(m.size),
      type: cleanString(m.type),
      speedMHz: positiveOrNull(m.clockSpeed),
      manufacturer: cleanString(m.manufacturer),
      partNumber: cleanString(m.partNum),
      serialNumber: cleanString(m.serialNum),
      formFactor: cleanString(m.formFactor)
    }))
  const disks = disksData
    .filter((d) => (d.size ?? 0) > 0)
    .map((d) => ({
      name: cleanString(d.name) ?? cleanString(d.device) ?? 'Disk',
      vendor: cleanString(d.vendor),
      type: cleanString(d.type),
      capacityGB: bytesToGB(d.size),
      interfaceType: cleanString(d.interfaceType),
      serialNumber: cleanString(d.serialNum),
      smartStatus: cleanString(d.smartStatus)
    }))
  const batteryInfo = batteryData.hasBattery
    ? {
        manufacturer: cleanString(batteryData.manufacturer),
        model: cleanString(batteryData.model),
        serialNumber: cleanString(batteryData.serial),
        chemistry: cleanString(batteryData.type),
        designedCapacityMWh: positiveOrNull(batteryData.designedCapacity)
      }
    : null
  return {
    device: deviceInfo,
    bios: biosInfo,
    os: osData,
    cpu: {
      manufacturer: cpuData.manufacturer,
      brand: cpuData.brand,
      family: cleanString(cpuData.family),
      model: cleanString(cpuData.model),
      socket: cleanString(cpuData.socket),
      cores: cpuData.cores,
      physicalCores: cpuData.physicalCores,
      baseSpeedGHz: cpuData.speed,
      maxSpeedGHz: positiveOrNull(cpuData.speedMax),
      cache: {
        l1dKB: bytesToKBOrNull(cacheData.l1d),
        l1iKB: bytesToKBOrNull(cacheData.l1i),
        l2KB: bytesToKBOrNull(cacheData.l2),
        l3KB: bytesToKBOrNull(cacheData.l3)
      }
    },
    memory: {
      totalGB: bytesToGB(memData.total),
      moduleCount: modules.length,
      modules
    },
    storage: {
      totalGB: Math.round(disks.reduce((sum, d) => sum + d.capacityGB, 0) * 10) / 10,
      disks
    },
    battery: batteryInfo
  }
}

export async function getDynamicSystemInfo() {
  const [loadData, mainDisk, batteryInfo, batteriesRaw] = await Promise.all([
    si.currentLoad(),
    getMainDisk(),
    buildBatteryInfo(),
    queryBatteriesIfMultiple()
  ])
  // Read straight from the OS: si.mem() also queries the page file through
  // PowerShell, which the dashboard doesn't show.
  const memData = { total: os.totalmem(), free: os.freemem() }
  memData.used = memData.total - memData.free
  const batteries = batteriesRaw.length > 1 ? batteriesRaw.map(buildBatteryDeviceInfo) : []
  return {
    cpu: {
      loadPercent: Math.round(loadData.currentLoad)
    },
    memory: {
      usedGB: bytesToGB(memData.used),
      freeGB: bytesToGB(memData.free),
      usedPercent: Math.round((memData.used / memData.total) * 100)
    },
    storage: mainDisk
      ? {
          usedGB: bytesToGB(mainDisk.used),
          usedPercent: Math.round(mainDisk.use)
        }
      : null,
    battery: batteryInfo,
    batteries
  }
}
