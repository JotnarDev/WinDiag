<#
====================================================================================
 Crear-Icono.ps1
====================================================================================
 Draws the Mannaz rune (the Norse "M" rune - two verticals joined by two crossing
 diagonals) onto a circular dark badge and saves it as Runa-M.ico, used as the icon
 for Diagnostico-Hardware.exe and InstaladorUSB.exe.

 This runs automatically from build.bat before compiling, so there is normally no
 need to run it by hand. It only uses .NET's built-in System.Drawing (GDI+), already
 present with Windows/.NET Framework - no extra tools or downloads required.
====================================================================================
#>

Add-Type -AssemblyName System.Drawing

$carpeta = $PSScriptRoot
if (-not $carpeta) { $carpeta = Split-Path -Path $MyInvocation.MyCommand.Path -Parent }
$rutaSalida = Join-Path -Path $carpeta -ChildPath "Runa-M.ico"

$tamano = 256
$bmp = New-Object System.Drawing.Bitmap $tamano, $tamano
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

try {
    # Dark circular badge background, with a bronze-ish ring border.
    $colorFondo = [System.Drawing.Color]::FromArgb(255, 24, 24, 26)
    $brochaFondo = New-Object System.Drawing.SolidBrush $colorFondo
    $g.FillEllipse($brochaFondo, 6, 6, $tamano - 12, $tamano - 12)

    $colorBorde = [System.Drawing.Color]::FromArgb(255, 120, 96, 56)
    $plumaBorde = New-Object System.Drawing.Pen $colorBorde, 6
    $g.DrawEllipse($plumaBorde, 9, 9, $tamano - 18, $tamano - 18)

    # The Mannaz rune itself: two verticals joined by two diagonals crossing in the
    # middle - the same shape used in the console banner / reference image, reading
    # like a bold, angular "M".
    $colorRuna = [System.Drawing.Color]::FromArgb(255, 236, 227, 202)
    $pluma = New-Object System.Drawing.Pen $colorRuna, 22
    $pluma.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pluma.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $izquierda = 68
    $derecha = $tamano - 68
    $arriba = 60
    $abajo = $tamano - 55
    $medio = $tamano / 2

    $g.DrawLine($pluma, $izquierda, $abajo, $izquierda, $arriba)
    $g.DrawLine($pluma, $derecha, $abajo, $derecha, $arriba)
    $g.DrawLine($pluma, $izquierda, $arriba, $derecha, $medio)
    $g.DrawLine($pluma, $derecha, $arriba, $izquierda, $medio)

    $g.Dispose()

    # Note: GetHicon() hands out a native icon handle that technically should be released
    # with DestroyIcon after use. This script is a short-lived, one-shot build step (the
    # process exits right after), so that one handle is freed automatically by Windows when
    # the process ends - not worth the extra P/Invoke declaration just for this.
    $hIcono = $bmp.GetHicon()
    $icono = [System.Drawing.Icon]::FromHandle($hIcono)
    $flujo = [System.IO.File]::Open($rutaSalida, [System.IO.FileMode]::Create)
    try {
        $icono.Save($flujo)
    }
    finally {
        $flujo.Close()
    }
    $icono.Dispose()

    Write-Host "Icon generated: $rutaSalida" -ForegroundColor Green
}
catch {
    Write-Host "Could not generate the icon: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "The build will continue without a custom icon." -ForegroundColor Yellow
}
finally {
    $bmp.Dispose()
}
