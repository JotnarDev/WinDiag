import { runPowerShell } from './powershell'
import { isRunningElevated } from './system-tools'

const EMPTY_RESULT = {
  model: null,
  mediaType: null,
  windowsHealthStatus: null,
  sizeBytes: null,
  wearPercent: null,
  temperatureC: null,
  temperatureMaxC: null,
  powerOnHours: null,
  readErrorsCorrected: null,
  readErrorsUncorrected: null,
  writeErrorsCorrected: null,
  writeErrorsUncorrected: null,
  healthPercent: null,
  healthStatus: 'unknown',
  supported: false,
  reliabilityError: null,
  isElevated: null
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const DISK_HEALTH_PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
    $driveLetter = $env:SystemDrive.TrimEnd(':')
    $partition = Get-Partition -DriveLetter $driveLetter -ErrorAction Stop
    $disk = Get-Disk -Number $partition.DiskNumber -ErrorAction Stop
    $physicalDisk = $disk | Get-PhysicalDisk -ErrorAction Stop | Select-Object -First 1

    $reliability = $null
    $reliabilityError = $null
    try {
        $reliability = $physicalDisk | Get-StorageReliabilityCounter -ErrorAction Stop
    } catch {
        $reliabilityError = $_.Exception.Message
    }

    $result = [PSCustomObject]@{
        Model                  = $physicalDisk.FriendlyName
        MediaType              = $physicalDisk.MediaType.ToString()
        HealthStatus           = $physicalDisk.HealthStatus.ToString()
        SizeBytes              = $physicalDisk.Size
        Wear                   = if ($reliability -and $null -ne $reliability.Wear) { [int]$reliability.Wear } else { $null }
        Temperature            = if ($reliability -and $null -ne $reliability.Temperature) { [int]$reliability.Temperature } else { $null }
        TemperatureMax         = if ($reliability -and $null -ne $reliability.TemperatureMax) { [int]$reliability.TemperatureMax } else { $null }
        PowerOnHours           = if ($reliability -and $null -ne $reliability.PowerOnHours) { [int]$reliability.PowerOnHours } else { $null }
        ReadErrorsCorrected    = if ($reliability) { [int64]$reliability.ReadErrorsCorrected } else { $null }
        ReadErrorsUncorrected  = if ($reliability) { [int64]$reliability.ReadErrorsUncorrected } else { $null }
        WriteErrorsCorrected   = if ($reliability) { [int64]$reliability.WriteErrorsCorrected } else { $null }
        WriteErrorsUncorrected = if ($reliability) { [int64]$reliability.WriteErrorsUncorrected } else { $null }
        ReliabilityError       = $reliabilityError
    }
    $result | ConvertTo-Json -Compress
} catch {
    '{}'
}
`.trim()
function computeHealthPercent(input) {
  const {
    wear,
    readUncorrected,
    writeUncorrected,
    readCorrected,
    writeCorrected,
    temperatureMax,
    isHdd
  } = input
  if (
    wear === null &&
    readUncorrected === null &&
    writeUncorrected === null &&
    readCorrected === null &&
    writeCorrected === null
  ) {
    return null
  }
  let health = 100
  if (wear !== null) health -= wear
  const uncorrected = (readUncorrected ?? 0) + (writeUncorrected ?? 0)
  health -= Math.min(uncorrected * 10, 40)
  // Hard drives routinely report huge corrected-error counts (ECC doing its
  // normal job — often millions on Seagate drives), so they only count
  // against SSDs.
  if (!isHdd) {
    const corrected = (readCorrected ?? 0) + (writeCorrected ?? 0)
    health -= Math.min(corrected * 0.2, 10)
  }
  if (temperatureMax !== null && temperatureMax > 55) {
    health -= Math.min((temperatureMax - 55) * 2, 15)
  }
  return Math.max(0, Math.min(100, Math.round(health)))
}

function healthStatusFromPercent(percent) {
  if (percent === null) return 'unknown'
  if (percent >= 90) return 'excellent'
  if (percent >= 75) return 'good'
  if (percent >= 50) return 'fair'
  if (percent >= 25) return 'poor'
  return 'critical'
}

export async function getMainDiskHealth() {
  try {
    const [trimmed, isElevated] = await Promise.all([
      runPowerShell(DISK_HEALTH_PS_SCRIPT, 15e3),
      isRunningElevated()
    ])
    const raw = trimmed ? JSON.parse(trimmed) : {}
    if (!raw.Model) return { ...EMPTY_RESULT, isElevated }
    const wearPercent = num(raw.Wear)
    const temperatureC = num(raw.Temperature)
    const temperatureMaxC = num(raw.TemperatureMax)
    const powerOnHours = num(raw.PowerOnHours)
    const readErrorsCorrected = num(raw.ReadErrorsCorrected)
    const readErrorsUncorrected = num(raw.ReadErrorsUncorrected)
    const writeErrorsCorrected = num(raw.WriteErrorsCorrected)
    const writeErrorsUncorrected = num(raw.WriteErrorsUncorrected)
    const healthPercent = computeHealthPercent({
      wear: wearPercent,
      readUncorrected: readErrorsUncorrected,
      writeUncorrected: writeErrorsUncorrected,
      readCorrected: readErrorsCorrected,
      writeCorrected: writeErrorsCorrected,
      temperatureMax: temperatureMaxC,
      isHdd: raw.MediaType === 'HDD'
    })
    return {
      model: raw.Model,
      mediaType: raw.MediaType ?? null,
      windowsHealthStatus: raw.HealthStatus ?? null,
      sizeBytes: num(raw.SizeBytes),
      wearPercent,
      temperatureC,
      temperatureMaxC,
      powerOnHours,
      readErrorsCorrected,
      readErrorsUncorrected,
      writeErrorsCorrected,
      writeErrorsUncorrected,
      healthPercent,
      healthStatus: healthStatusFromPercent(healthPercent),
      supported: true,
      reliabilityError: raw.ReliabilityError ?? null,
      isElevated
    }
  } catch {
    return EMPTY_RESULT
  }
}
