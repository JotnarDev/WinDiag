<#
====================================================================================
 Install-To-USB.ps1 - download the toolkit straight onto a USB drive
====================================================================================
 For setting up a USB drive on a machine that doesn't have the toolkit yet (and may
 never need it installed locally at all): plug in a USB drive, run this, and the
 portable toolkit ends up ready to run from that drive on any Toughbook.

 One-liner usage (paste into PowerShell, with a USB drive already plugged in):

   irm https://raw.githubusercontent.com/JotnarDev/hardware-diagnostics-tool/main/bootstrap/Install-To-USB.ps1 | iex

 This downloads the repository, then copies app/ (Diagnostico-Hardware.ps1, the
 no-compile launcher Iniciar-Diagnostico.bat, and everything else needed to run)
 onto the chosen USB drive under a "Diagnostico-Hardware" folder.

 If a C# compiler (csc.exe, included with every Windows 10/11 install) is available
 on this machine, this script also tries to compile Diagnostico-Hardware.exe so the
 USB gets a proper double-click launcher with a UAC prompt and custom icon. If that
 isn't available, or compiling fails for any reason, the USB drive still works fine
 via Iniciar-Diagnostico.bat - no compiling required either way.
====================================================================================
#>

$ErrorActionPreference = 'Stop'

function Find-CscExe {
    $candidatos = @(
        (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
        (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
    )
    foreach ($c in $candidatos) { if (Test-Path -Path $c) { return $c } }
    return $null
}

# 1) Find a USB drive plugged into this machine.
$unidades = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=2" -ErrorAction SilentlyContinue)
if ($unidades.Count -eq 0) {
    Write-Host "No USB drive was detected. Plug one in and try again." -ForegroundColor Red
    return
}

$unidadElegida = $null
if ($unidades.Count -eq 1) {
    $unidadElegida = $unidades[0].DeviceID
    Write-Host "Using USB drive $unidadElegida" -ForegroundColor Cyan
}
else {
    Write-Host "Multiple USB drives detected:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $unidades.Count; $i++) {
        $u = $unidades[$i]
        $libreGB = [math]::Round($u.FreeSpace / 1GB, 1)
        $nombre = if ($u.VolumeName) { $u.VolumeName } else { "(no label)" }
        Write-Host ("  [{0}] {1}  {2}  -  {3} GB free" -f $i, $u.DeviceID, $nombre, $libreGB)
    }
    $seleccion = Read-Host "Enter the number of the drive to use"
    $unidadElegida = $unidades[[int]$seleccion].DeviceID
}

# 2) Download and extract the repository.
$repoZipUrl = "https://github.com/JotnarDev/hardware-diagnostics-tool/archive/refs/heads/main.zip"
$carpetaTemp = Join-Path -Path $env:TEMP -ChildPath ("Jotnar-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$rutaZip = Join-Path -Path $carpetaTemp -ChildPath "repo.zip"
New-Item -Path $carpetaTemp -ItemType Directory -Force | Out-Null

Write-Host "Downloading Hardware Diagnostics Tool..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $repoZipUrl -OutFile $rutaZip -UseBasicParsing

Write-Host "Extracting..." -ForegroundColor Cyan
Expand-Archive -Path $rutaZip -DestinationPath $carpetaTemp -Force

$carpetaRepo = Get-ChildItem -Path $carpetaTemp -Directory |
    Where-Object { $_.Name -like "hardware-diagnostics-tool-*" } |
    Select-Object -First 1
if (-not $carpetaRepo) { throw "Could not find the extracted repository folder." }

$carpetaAppOrigen = Join-Path -Path $carpetaRepo.FullName -ChildPath "app"
if (-not (Test-Path -Path $carpetaAppOrigen)) {
    throw "Could not find the app folder after extracting the download."
}

# 3) Best-effort compile, so the USB gets a proper .exe. Purely optional - the
#    toolkit works fine from the USB drive without it (via Iniciar-Diagnostico.bat).
$csc = Find-CscExe
if ($csc) {
    try {
        Write-Host "Compiling Diagnostico-Hardware.exe..." -ForegroundColor Cyan

        $rutaCrearIcono = Join-Path $carpetaAppOrigen "Crear-Icono.ps1"
        if (Test-Path -Path $rutaCrearIcono) {
            powershell -NoProfile -ExecutionPolicy Bypass -File $rutaCrearIcono | Out-Null
        }

        $rutaIco = Join-Path $carpetaAppOrigen "Runa-M.ico"
        $cscArgs = @(
            "/nologo", "/target:winexe", "/platform:anycpu",
            "/out:$(Join-Path $carpetaAppOrigen 'Diagnostico-Hardware.exe')",
            "/win32manifest:$(Join-Path $carpetaAppOrigen 'app.manifest')"
        )
        if (Test-Path -Path $rutaIco) { $cscArgs += "/win32icon:$rutaIco" }
        $cscArgs += @(
            "/reference:System.dll", "/reference:System.Windows.Forms.dll",
            (Join-Path $carpetaAppOrigen "Launcher.cs")
        )
        & $csc @cscArgs
    }
    catch {
        Write-Host "Could not compile the .exe launcher (continuing without it - Iniciar-Diagnostico.bat still works): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "C# compiler not found - skipping .exe compilation (Iniciar-Diagnostico.bat still works fine)." -ForegroundColor Yellow
}

# 4) Copy everything onto the USB drive.
$carpetaDestino = Join-Path -Path "$unidadElegida\" -ChildPath "Diagnostico-Hardware"
New-Item -Path $carpetaDestino -ItemType Directory -Force | Out-Null
Copy-Item -Path (Join-Path $carpetaAppOrigen "*") -Destination $carpetaDestino -Recurse -Force

Write-Host ""
Write-Host "Done. The toolkit is ready at: $carpetaDestino" -ForegroundColor Green
Write-Host "Add your own wifi-config.txt there (see wifi-config.example.txt) if you want WiFi auto-connect." -ForegroundColor DarkGray
