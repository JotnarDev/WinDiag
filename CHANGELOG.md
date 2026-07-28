# Changelog

All notable changes to this project are documented here. Versions correspond to the
`Version` value at the top of `app/Diagnostico-Hardware.ps1` (`$Global:VersionHerramienta`).

## [3.0.0] - 2026

The current release. Highlights of what shipped on the way to this version:

### Added
- Bilingual UI (English default, Spanish) with a header language toggle; every
  user-facing string routed through a single translation table.
- Full catalog-driven test system: automatic tests (Windows Update, WiFi, Windows
  Activation, drivers, driver versions, battery, Bluetooth, WWAN, optical drive, BIOS,
  CPU, RAM, disk) and guided/interactive tests (USB, DVD, camera, audio, microphone,
  keyboard, touchpad, touch screen, biometric reader, SmartCard reader, barcode reader,
  GPS, stylus, ports), each with automatic hardware detection so irrelevant tiles never
  show up on hardware that doesn't have that component.
- Equipment info panel (model/serial/BIOS/CPU/RAM/disk), queried live via WMI/CIM.
- Console pre-flight: equipment identification, plus Windows Update / WiFi / Windows
  Activation, all run before the main window opens, with an ASCII step-by-step progress
  readout in the console.
- Dedicated full-screen color/backlight screen test with on-screen brightness control.
- One-click shortcuts to the Windows touch screen calibration tool (`tabcal.exe`) and to
  Sysprep (destructive action, confirmed before running).
- Tile-based sidebar: automatic tests color by PASS/FAIL/WARNING/INFO result; guided
  tests show a flat "completed" indicator once answered.
- Responsive window sizing (adapts to the screen's work area, opens maximized) and a
  results table that resizes its columns to fit any window width.
- Reporting: plain-text report, CSV export, and an appendable Excel export row - all
  named after the detected serial number by default.
- End-of-session prompt: asks once whether the job is tied to a work order, and only then
  asks for the order number.
- USB installer (`Instalar-USB.ps1` / `InstaladorUSB.exe`) to copy the whole toolkit onto
  a USB drive for use across multiple machines.
- WiFi credentials externalized to `wifi-config.txt` (read at startup), instead of being
  hardcoded in the script - keeps real network credentials out of source control.

### Changed
- Removed the old "Settings" tab entirely; configuration that used to be typed in by hand
  (unit number, work order, WiFi SSID/password) is now either auto-detected or asked for
  once, only when actually needed.

## Earlier versions

Not tracked individually - this changelog starts from the point the project was prepared
for its move to this repository. See `docs/ARCHITECTURE.md` for how the current design
came to be.
