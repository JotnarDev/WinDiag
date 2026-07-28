@echo off
rem ====================================================================
rem Lanzador alternativo SIN compilacion.
rem No es un .exe, pero funciona igual con un doble clic: el propio
rem Diagnostico-Hardware.ps1 ya detecta si falta el permiso de
rem Administrador y muestra el dialogo de UAC por su cuenta.
rem Util si no puede o no desea compilar Diagnostico-Hardware.exe.
rem ====================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Diagnostico-Hardware.ps1"
