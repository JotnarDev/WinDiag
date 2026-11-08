import { spawn } from 'child_process'
import path from 'path'
import { shell } from 'electron'
import { runPowerShell } from './powershell'
import { runActionScript } from './elevated'

/*
 * The home edition's Security page: how well this PC is protected, read
 * without admin rights, and the few safe fixes WinDiag can make itself.
 * Everything else opens the right page of Windows Security or Settings.
 */

const isWindows = process.platform === 'win32'

function requireWindows() {
  if (!isWindows) throw new Error('Only available on Windows')
}

const STATUS_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
function Iso($date) { if ($date -and $date.Year -gt 1601) { $date.ToUniversalTime().ToString('o') } else { $null } }
function Reg($path, $name) { (Get-ItemProperty -LiteralPath $path -Name $name -ErrorAction SilentlyContinue).$name }

# Antivirus as Windows Security Center reports it: productState's middle
# byte 0x10/0x11 = on, the last byte 0x00 = definitions up to date
$antivirus = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object {
    $hex = '{0:x6}' -f [int]$_.productState
    @{ name = [string]$_.displayName; on = $hex.Substring(2, 2) -in @('10', '11'); upToDate = $hex.Substring(4, 2) -eq '00' }
})

$defender = $null
$mp = Get-MpComputerStatus
if ($mp) {
    $defender = @{
        mode = [string]$mp.AMRunningMode
        realTime = [bool]$mp.RealTimeProtectionEnabled
        signaturesUpdated = Iso $mp.AntivirusSignatureLastUpdated
        quickScan = Iso $mp.QuickScanEndTime
        fullScan = Iso $mp.FullScanEndTime
        tamper = [bool]$mp.IsTamperProtected
        pua = $(try { [int](Get-MpPreference).PUAProtection } catch { $null })
    }
}

$firewall = @(Get-NetFirewallProfile | ForEach-Object { @{ name = [string]$_.Name; on = ("$($_.Enabled)" -eq 'True') } })

# BitLocker / device encryption of the Windows drive, as File Explorer shows it
$encryption = $null
try {
    $drive = $env:SystemDrive
    $encryption = (New-Object -ComObject Shell.Application).NameSpace("$drive\").Self.ExtendedProperty('System.Volume.BitLockerProtection')
} catch {}

$tpm = @(Get-PnpDevice -Class SecurityDevices -PresentOnly | Where-Object { $_.FriendlyName -match 'Trusted Platform Module' } | ForEach-Object { [string]$_.FriendlyName }) | Select-Object -First 1

$system = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
ConvertTo-Json -Compress -Depth 4 -InputObject @{
    antivirus = $antivirus
    defender = $defender
    firewall = $firewall
    encryption = $(if ($null -ne $encryption) { [int]$encryption } else { $null })
    secureBoot = Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State' 'UEFISecureBootEnabled'
    tpm = $tpm
    memoryIntegrity = Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity' 'Enabled'
    uac = @{ enabled = Reg $system 'EnableLUA'; adminPrompt = Reg $system 'ConsentPromptBehaviorAdmin' }
}
`

// System.Volume.BitLockerProtection
const ENCRYPTION = {
  0: 'unsupported',
  1: 'on',
  2: 'off',
  3: 'encrypting',
  4: 'decrypting',
  5: 'suspended',
  6: 'on',
  8: 'waiting'
}

/** Everything the Security page shows, read without admin rights. */
export async function getSecurityStatus() {
  requireWindows()
  const raw = JSON.parse(await runPowerShell(STATUS_SCRIPT, 45e3))
  const tpmName = typeof raw.tpm === 'string' ? raw.tpm : null
  return {
    antivirus: [raw.antivirus ?? []].flat(),
    defender: raw.defender ?? null,
    firewall: [raw.firewall ?? []].flat(),
    encryption: raw.encryption === null ? null : (ENCRYPTION[raw.encryption] ?? null),
    // null: the PC starts in legacy BIOS mode, which has no Secure Boot
    secureBoot:
      raw.secureBoot === null || raw.secureBoot === undefined ? null : raw.secureBoot === 1,
    tpm: tpmName
      ? { version: /2\.0/.test(tpmName) ? '2.0' : /1\.2/.test(tpmName) ? '1.2' : null }
      : null,
    memoryIntegrity: raw.memoryIntegrity === 1,
    uac: {
      enabled: raw.uac?.enabled !== 0,
      // 0 = elevate without asking
      prompts: raw.uac?.adminPrompt !== 0
    }
  }
}

/* --- Fixes ----------------------------------------------------------------- */

/** Gets Microsoft Defender's latest definitions. */
export async function updateDefender() {
  requireWindows()
  const script = "Update-MpSignature\n'done'"
  const result = await runActionScript(script, {
    label: 'Updating Defender definitions',
    isolated: true,
    timeoutMs: 600e3
  })
  // Some PCs only allow it with admin rights
  if (!result.ok && !result.cancelled && /denied|0x80070005/i.test(result.error ?? ''))
    return runActionScript(script, {
      admin: true,
      label: 'Updating Defender definitions',
      isolated: true,
      timeoutMs: 600e3
    })
  return result
}

/** A quick Defender scan; minutes, in its own PowerShell. */
export function quickScan() {
  requireWindows()
  return runActionScript("Start-MpScan -ScanType QuickScan\n'done'", {
    label: 'Defender quick scan',
    isolated: true,
    timeoutMs: 2 * 3600e3
  })
}

/** Turns the firewall on for every network type. */
export function turnOnFirewall() {
  requireWindows()
  return runActionScript(
    "Set-NetFirewallProfile -Profile Domain, Private, Public -Enabled True\n'done'",
    { admin: true, label: 'Turning on the firewall' }
  )
}

/** Blocks potentially unwanted apps (adware, bundled toolbars) in Defender. */
export function setPuaProtection(on) {
  requireWindows()
  return runActionScript(`Set-MpPreference -PUAProtection ${on ? 'Enabled' : 'Disabled'}\n'done'`, {
    admin: true,
    label: `Defender: blocking unwanted apps ${on ? 'on' : 'off'}`
  })
}

/* --- Pages ----------------------------------------------------------------- */

const systemRoot = () => process.env.SystemRoot ?? 'C:\\Windows'

const PAGES = {
  virusProtection: { uri: 'windowsdefender://threat' },
  virusSettings: { uri: 'windowsdefender://threatsettings' },
  protectionHistory: { uri: 'windowsdefender://history' },
  coreIsolation: { uri: 'windowsdefender://coreisolation' },
  deviceSecurity: { uri: 'windowsdefender://devicesecurity' },
  firewall: { uri: 'windowsdefender://network' },
  deviceEncryption: { uri: 'ms-settings:deviceencryption' },
  recoveryKey: { uri: 'https://account.microsoft.com/devices/recoverykey' },
  bitlocker: { exe: 'control.exe', args: ['/name', 'Microsoft.BitLockerDriveEncryption'] },
  uac: { exe: 'UserAccountControlSettings.exe', args: [] }
}

/** Opens a page of Windows Security or Settings from a fixed list. */
export async function openSecurityPage(id) {
  requireWindows()
  const page = PAGES[id]
  if (!page) throw new Error(`Unknown page: ${id}`)
  if (page.uri) {
    await shell.openExternal(page.uri)
    return true
  }
  const file = path.join(systemRoot(), 'System32', page.exe)
  // Started on its own: these windows stay open long after this call
  await new Promise((resolve, reject) => {
    const child = spawn(file, page.args, { detached: true, stdio: 'ignore' })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
  return true
}
