<#
====================================================================================
 Run-Jotnar.ps1 - run the Hardware Diagnostics Tool directly, no installation
====================================================================================
 Downloads the latest version straight from GitHub into a temporary folder and
 launches it immediately. Nothing gets installed anywhere - the only thing left
 behind afterward is the temporary download itself (a few hundred KB under
 %TEMP%), which Windows cleans up on its own over time. It is deliberately NOT
 deleted automatically by this script - see the note in the try/catch below for why.

 One-liner usage (paste into a regular PowerShell prompt - Administrator is not
 required, the tool elevates itself automatically if needed):

   irm https://raw.githubusercontent.com/JotnarDev/hardware-diagnostics-tool/main/bootstrap/Run-Jotnar.ps1 | iex

 Why download to a real file instead of just piping straight into "iex"? The tool
 relaunches itself (for Administrator elevation and STA mode), and that relies on
 knowing its own file path on disk via $PSCommandPath - which only exists if it is
 an actual .ps1 file sitting on disk, not a script running from an in-memory
 pipeline. Downloading it first, then invoking it with the call operator (&),
 keeps that working exactly as it does when run locally.

 Note: this temporary copy does not include wifi-config.txt (only the repo's blank
 wifi-config.example.txt ships here), so the WiFi test will simply skip auto-connect
 and report adapter status only. It also won't have the optional third-party tools
 (keytest.exe, BatteryInfoView.exe) unless you add them to the temp folder yourself
 before running - see docs/BUILD.md in the repository for details.
====================================================================================
#>

$ErrorActionPreference = 'Stop'

$repoZipUrl = "https://github.com/JotnarDev/hardware-diagnostics-tool/archive/refs/heads/main.zip"
$carpetaTemp = Join-Path -Path $env:TEMP -ChildPath ("Jotnar-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$rutaZip = Join-Path -Path $carpetaTemp -ChildPath "repo.zip"

New-Item -Path $carpetaTemp -ItemType Directory -Force | Out-Null

try {
    Write-Host "Downloading Hardware Diagnostics Tool..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $repoZipUrl -OutFile $rutaZip -UseBasicParsing

    Write-Host "Extracting..." -ForegroundColor Cyan
    Expand-Archive -Path $rutaZip -DestinationPath $carpetaTemp -Force

    $carpetaRepo = Get-ChildItem -Path $carpetaTemp -Directory |
        Where-Object { $_.Name -like "hardware-diagnostics-tool-*" } |
        Select-Object -First 1
    if (-not $carpetaRepo) { throw "Could not find the extracted repository folder." }

    $rutaScript = Join-Path -Path $carpetaRepo.FullName -ChildPath "app\Diagnostico-Hardware.ps1"
    if (-not (Test-Path -Path $rutaScript)) {
        throw "Diagnostico-Hardware.ps1 was not found after extracting the download."
    }

    Write-Host "Launching..." -ForegroundColor Cyan
    Write-Host ""

    # Deliberately NOT cleaned up afterward: the tool may relaunch itself (for
    # Administrator/STA) as a separate detached process and then exit this one
    # immediately - if we deleted $carpetaTemp right after "&" returns, we could
    # yank the script out from under that relaunched process while it's still
    # starting up. Leaving the temp folder in place avoids that race entirely.
    & $rutaScript
}
catch {
    Write-Host "Could not download/launch the tool: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Temporary files (if any) are at: $carpetaTemp" -ForegroundColor DarkGray
}
