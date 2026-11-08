/*
 * PowerShell that makes a System Restore point, for scripts that already run
 * as administrator. Windows makes at most one a day unless told otherwise,
 * and Checkpoint-Computer may only warn when it can't make one, so the
 * script checks that a new point is there. On failure it throws an error
 * starting with "RESTORE_POINT:".
 *
 * enable: turn on System Protection for the Windows drive first.
 */
export const restorePointScript = (description, { enable = false } = {}) => String.raw`
$key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore'
$old = (Get-ItemProperty -LiteralPath $key -Name SystemRestorePointCreationFrequency -ErrorAction SilentlyContinue).SystemRestorePointCreationFrequency
New-ItemProperty -LiteralPath $key -Name SystemRestorePointCreationFrequency -PropertyType DWord -Value 0 -Force | Out-Null
try {
    if (${enable ? '$true' : '$false'}) { Enable-ComputerRestore -Drive "$env:SystemDrive\" }
    Checkpoint-Computer -Description '${description.replace(/'/g, "''")}' -RestorePointType MODIFY_SETTINGS
    $latest = Get-ComputerRestorePoint | Select-Object -Last 1
    if (-not $latest -or [Management.ManagementDateTimeConverter]::ToDateTime($latest.CreationTime) -lt (Get-Date).AddMinutes(-15)) {
        throw 'No restore point was created'
    }
} catch {
    throw "RESTORE_POINT: $($_.Exception.Message)"
} finally {
    if ($null -eq $old) { Remove-ItemProperty -LiteralPath $key -Name SystemRestorePointCreationFrequency -ErrorAction SilentlyContinue }
    else { New-ItemProperty -LiteralPath $key -Name SystemRestorePointCreationFrequency -PropertyType DWord -Value $old -Force | Out-Null }
}
`
