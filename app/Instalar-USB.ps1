<#
====================================================================================
 Instalar-USB.ps1
====================================================================================
 Copies the compiled Hardware Diagnostics toolkit (Diagnostico-Hardware.exe, the
 .ps1 it runs, and its helper tools) onto a removable USB drive chosen by the
 technician, so the whole toolkit can be carried around and run from any Toughbook
 without reinstalling anything.

 Launched via InstaladorUSB.exe (a small native launcher, no Administrator rights
 needed - copying files to a USB stick doesn't require elevation).
====================================================================================
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$tituloVentana = "USB Installer - Hardware Diagnostics"

$carpetaOrigen = $PSScriptRoot
if (-not $carpetaOrigen) { $carpetaOrigen = Split-Path -Path $MyInvocation.MyCommand.Path -Parent }

# Diagnostico-Hardware.exe is what actually needs to exist (built via build.bat); the .ps1 is
# required alongside it since the exe launches PowerShell against that file.
$archivosNecesarios = @("Diagnostico-Hardware.exe", "Diagnostico-Hardware.ps1")

# Helper tools/config copied along if present, but not required for the copy to proceed.
$archivosOpcionales = @("keytest.exe", "BatteryInfoView.exe", "BatteryInfoView.cfg", "wifi-config.txt", "Runa-M.ico")

$faltantes = @($archivosNecesarios | Where-Object { -not (Test-Path -Path (Join-Path -Path $carpetaOrigen -ChildPath $_)) })
if ($faltantes.Count -gt 0) {
    [System.Windows.Forms.MessageBox]::Show(
        "These required files are missing from the tool's folder:`n`n" + ($faltantes -join "`n") +
        "`n`nRun build.bat first to compile Diagnostico-Hardware.exe.",
        $tituloVentana, 'OK', 'Error') | Out-Null
    exit
}

$unidades = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=2" -ErrorAction SilentlyContinue)
if ($unidades.Count -eq 0) {
    [System.Windows.Forms.MessageBox]::Show(
        "No USB drive was detected. Plug in a USB drive and try again.",
        $tituloVentana, 'OK', 'Warning') | Out-Null
    exit
}

function Get-EtiquetaUnidad {
    param($Unidad)
    $libreGB = [math]::Round($Unidad.FreeSpace / 1GB, 1)
    $totalGB = [math]::Round($Unidad.Size / 1GB, 1)
    $nombre = if ($Unidad.VolumeName) { $Unidad.VolumeName } else { "(no label)" }
    return "$($Unidad.DeviceID)  $nombre  -  $libreGB GB free of $totalGB GB"
}

$unidadElegida = $null

if ($unidades.Count -eq 1) {
    $u = $unidades[0]
    $resultado = [System.Windows.Forms.MessageBox]::Show(
        "USB drive detected:`n$(Get-EtiquetaUnidad -Unidad $u)`n`nInstall the toolkit there?",
        $tituloVentana, 'YesNo', 'Question')
    if ($resultado -eq [System.Windows.Forms.DialogResult]::Yes) { $unidadElegida = $u.DeviceID }
}
else {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Choose a USB drive"
    $form.Width = 460
    $form.Height = 200
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.BackColor = [System.Drawing.Color]::FromArgb(255, 30, 30, 30)

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = "Several USB drives were detected. Choose where to install:"
    $lbl.ForeColor = [System.Drawing.Color]::White
    $lbl.AutoSize = $true
    $lbl.Location = New-Object System.Drawing.Point(15, 15)
    $form.Controls.Add($lbl)

    $combo = New-Object System.Windows.Forms.ComboBox
    $combo.DropDownStyle = 'DropDownList'
    $combo.Location = New-Object System.Drawing.Point(15, 45)
    $combo.Width = 410
    foreach ($u in $unidades) {
        [void]$combo.Items.Add((Get-EtiquetaUnidad -Unidad $u))
    }
    $combo.SelectedIndex = 0
    $form.Controls.Add($combo)

    $btnOk = New-Object System.Windows.Forms.Button
    $btnOk.Text = "Install"
    $btnOk.Location = New-Object System.Drawing.Point(260, 110)
    $btnOk.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Controls.Add($btnOk)
    $form.AcceptButton = $btnOk

    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text = "Cancel"
    $btnCancel.Location = New-Object System.Drawing.Point(345, 110)
    $btnCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($btnCancel)
    $form.CancelButton = $btnCancel

    if ($form.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $unidadElegida = $unidades[$combo.SelectedIndex].DeviceID
    }
}

if (-not $unidadElegida) { exit }

try {
    $carpetaDestino = Join-Path -Path "$unidadElegida\" -ChildPath "Diagnostico-Hardware"
    if (-not (Test-Path -Path $carpetaDestino)) {
        New-Item -Path $carpetaDestino -ItemType Directory -Force | Out-Null
    }

    foreach ($archivo in ($archivosNecesarios + $archivosOpcionales)) {
        $origen = Join-Path -Path $carpetaOrigen -ChildPath $archivo
        if (Test-Path -Path $origen) {
            Copy-Item -Path $origen -Destination $carpetaDestino -Force
        }
    }

    [System.Windows.Forms.MessageBox]::Show(
        "Toolkit installed at:`n$carpetaDestino`n`nYou can now safely eject the USB drive and use it on any computer.",
        $tituloVentana, 'OK', 'Information') | Out-Null
}
catch {
    [System.Windows.Forms.MessageBox]::Show(
        "An error occurred while copying the files:`n$($_.Exception.Message)",
        $tituloVentana, 'OK', 'Error') | Out-Null
}
