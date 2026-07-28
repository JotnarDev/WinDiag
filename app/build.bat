@echo off
setlocal enabledelayedexpansion
title Compilando Diagnostico-Hardware.exe

echo ========================================
echo  Compilando Diagnostico-Hardware.exe
echo ========================================
echo.

rem ------------------------------------------------------------------
rem Busca csc.exe, el compilador de C# incluido de fabrica en .NET
rem Framework (presente en Windows 10 y 11 sin instalar nada extra).
rem ------------------------------------------------------------------
set "CSC="

if exist "%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
)

if not defined CSC (
    if exist "%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
        set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
    )
)

if not defined CSC (
    echo No se encontro el compilador de C# ^(csc.exe^) de .NET Framework en este equipo.
    echo Este archivo forma parte de Windows y normalmente esta en:
    echo   %%WINDIR%%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
    echo.
    echo Verifique que .NET Framework 4.x este instalado y vuelva a intentar.
    pause
    exit /b 1
)

echo Compilador encontrado:
echo   %CSC%
echo.

if not exist "%~dp0Launcher.cs" (
    echo No se encontro Launcher.cs en esta carpeta.
    pause
    exit /b 1
)

if not exist "%~dp0app.manifest" (
    echo No se encontro app.manifest en esta carpeta.
    pause
    exit /b 1
)

rem ------------------------------------------------------------------
rem Genera Runa-M.ico (icono con la runa nordica Mannaz) antes de
rem compilar, para que ambos .exe lo usen. Si algo falla generandolo,
rem la compilacion continua igual, solo que sin icono personalizado.
rem ------------------------------------------------------------------
echo Generando icono (runa Mannaz)...
if exist "%~dp0Crear-Icono.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Crear-Icono.ps1"
) else (
    echo   Crear-Icono.ps1 no encontrado; se omite la generacion del icono.
)

set ICONO=
if exist "%~dp0Runa-M.ico" (
    set ICONO=/win32icon:"%~dp0Runa-M.ico"
)
echo.

echo Compilando Diagnostico-Hardware.exe...
"%CSC%" /nologo /target:winexe /platform:anycpu /out:"%~dp0Diagnostico-Hardware.exe" /win32manifest:"%~dp0app.manifest" %ICONO% /reference:System.dll /reference:System.Windows.Forms.dll "%~dp0Launcher.cs"

if errorlevel 1 (
    echo.
    echo ========================================
    echo  La compilacion de Diagnostico-Hardware.exe fallo. Revise los errores arriba.
    echo ========================================
    pause
    exit /b 1
)

echo.
echo Compilacion de Diagnostico-Hardware.exe exitosa.
echo.

rem ------------------------------------------------------------------
rem Instalador USB (opcional): solo se compila si estan presentes
rem InstaladorUSB.cs e Instalar-USB.ps1. No requiere manifiesto de
rem administrador, ya que copiar archivos a una memoria USB no lo
rem necesita.
rem ------------------------------------------------------------------
set INSTALADOR_OK=0
if exist "%~dp0InstaladorUSB.cs" if exist "%~dp0Instalar-USB.ps1" set INSTALADOR_OK=1

if "%INSTALADOR_OK%"=="1" (
    echo Compilando InstaladorUSB.exe...
    "%CSC%" /nologo /target:winexe /platform:anycpu /out:"%~dp0InstaladorUSB.exe" %ICONO% /reference:System.dll /reference:System.Windows.Forms.dll "%~dp0InstaladorUSB.cs"

    if errorlevel 1 (
        echo.
        echo ========================================
        echo  La compilacion de InstaladorUSB.exe fallo. Revise los errores arriba.
        echo ========================================
        pause
        exit /b 1
    )

    echo.
    echo Compilacion de InstaladorUSB.exe exitosa.
    echo.
) else (
    echo InstaladorUSB.cs o Instalar-USB.ps1 no encontrados; se omite el instalador USB.
    echo.
)

echo ========================================
echo  Compilacion completa
echo ========================================
echo Se genero: Diagnostico-Hardware.exe
if exist "%~dp0InstaladorUSB.exe" echo Se genero: InstaladorUSB.exe
echo.
echo IMPORTANTE: mantenga estos .exe en la misma carpeta que
echo Diagnostico-Hardware.ps1 e Instalar-USB.ps1 (los launchers buscan
echo su script junto a si mismos).
echo.
echo Para copiar la herramienta a una memoria USB, conecte la memoria
echo y ejecute InstaladorUSB.exe.
echo.
pause
