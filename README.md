# Hardware Diagnostics Tool

A native PowerShell + WPF application for running a full hardware diagnostic pass on
refurbished Panasonic Toughbooks (and other Windows 10/11 laptops) before they ship out
to a customer. Built for **Jotnar** refurbishment technicians.

Everything happens through a single dark-themed, bilingual (English/Spanish) window: no
console prompts, no manual note-taking. The tool detects the equipment, runs a battery of
automatic checks, walks the technician through the guided (human-verified) checks, and
produces a report tied to the unit's serial number.

## Highlights

- **Automatic tests**: Windows Update service, WiFi connectivity, Windows Activation,
  driver health, driver versions, battery, Bluetooth, WWAN, optical drive, BIOS, CPU, RAM,
  disk. Each one is skipped automatically on hardware that doesn't have it (no Bluetooth
  radio on the machine? no Bluetooth tile shown).
- **Guided tests**: USB ports, DVD/CD drive, camera, speakers, microphone, keyboard,
  touchpad, touch screen, biometric reader, SmartCard reader, barcode reader, GPS, stylus,
  and physical ports - each one asks the technician a yes/no/not-applicable question after
  walking them through how to check it.
- **Console pre-flight**: before the window even opens, the tool identifies the equipment
  (model/serial/BIOS/CPU/RAM/disk) and runs the Windows Update, WiFi, and Windows
  Activation checks right in the console, with an ASCII progress readout - so by the time
  the interface appears, the sidebar and equipment panel are already populated.
  Windows Update / WiFi / Windows Activation also stay available from "Start Automatic
  Diagnostics" for the technician to re-run later if needed.
- **Equipment info panel**: model, serial, BIOS version, CPU, RAM (with per-module detail),
  and disk, queried live via WMI/CIM every time it's shown.
  Includes one-click shortcuts to the touch screen calibration tool (`tabcal.exe`) and to
  Sysprep (with a confirmation prompt, since it resets the Windows install).
  Auto-detected serial number is used as the report's identifier by default - no manual
  data entry required before starting.
- **Screen test**: a dedicated full-screen color/backlight test (white/black/red/green/
  blue/50% gray), with on-screen brightness control.
- **Reporting**: save a plain-text report, export a CSV, or append a row to a running Excel
  export file - all named after the detected serial number. If the job is tied to a work
  order, the tool asks once, at the very end, for the order number.
- **Responsive UI**: the window sizes itself to the screen's actual work area and opens
  maximized, so it looks right on any Toughbook display.
- **USB installer**: a small companion tool (`InstaladorUSB.exe`) copies the whole toolkit
  onto a USB drive so it can be carried between machines without reinstalling anything.

See [`docs/FEATURES.md`](docs/FEATURES.md) for the complete, itemized list of every test
and what it checks.

## Requirements

- Windows 10 or Windows 11
- PowerShell 5.1+ (bundled with Windows) or PowerShell 7+
- No third-party PowerShell modules
- Administrator rights (the tool self-elevates via UAC if not already running elevated)

## Quick start

Fastest way to try it - paste into a PowerShell prompt, no download or install step:

```powershell
irm https://raw.githubusercontent.com/JotnarDev/hardware-diagnostics-tool/main/bootstrap/Run-Jotnar.ps1 | iex
```

That's one of four ways to get this running - see [`docs/INSTALL.md`](docs/INSTALL.md)
for all of them: running it directly (above), installing it onto a USB drive with one
command, a ready-to-run portable ZIP, or a proper Windows installer (Setup.exe) - the
last two are published on the [Releases page](https://github.com/JotnarDev/hardware-diagnostics-tool/releases)
for every tagged version.

To work with the source directly instead:

1. Clone or download this repository.
2. Open [`app/`](app/) - this folder is meant to stay flat; the launcher, the script, and
   its helper tools all expect to live side by side.
3. Copy `wifi-config.example.txt` to `wifi-config.txt` and fill in your WiFi network's
   SSID/password (see [`docs/BUILD.md`](docs/BUILD.md) for details). This file is
   gitignored, so your real credentials never get committed.
4. Either:
   - **Run without compiling**: double-click `Iniciar-Diagnostico.bat`. The script
     self-elevates and switches to the required STA mode on its own.
   - **Build a native launcher** (recommended for distributing to other technicians):
     run `build.bat`, which compiles `Diagnostico-Hardware.exe` (and, if present,
     `InstaladorUSB.exe`) using the C# compiler already bundled with Windows - no extra
     tools to install. See [`docs/BUILD.md`](docs/BUILD.md) for the full walkthrough.

## Repository structure

```
├── app/                        Flat runtime payload - keep these files together
│   ├── Diagnostico-Hardware.ps1   Main application (WPF UI + all diagnostic logic)
│   ├── Launcher.cs                 Native .exe entry point (UAC elevation + STA relaunch)
│   ├── app.manifest                 Manifest embedded into the launcher (requires admin)
│   ├── build.bat                    Compiles Launcher.cs / InstaladorUSB.cs with csc.exe
│   ├── Iniciar-Diagnostico.bat      No-compile launcher (double-click, no .exe needed)
│   ├── Crear-Icono.ps1              Generates the app icon (run automatically by build.bat)
│   ├── Instalar-USB.ps1             USB installer script (copies the toolkit to a USB drive)
│   ├── InstaladorUSB.cs             Native launcher for the USB installer
│   └── wifi-config.example.txt      Template for wifi-config.txt (see Quick start)
├── bootstrap/                  One-liner scripts that pull straight from GitHub
│   ├── Run-Jotnar.ps1               Download + run immediately, nothing installed
│   └── Install-To-USB.ps1           Download + copy onto a plugged-in USB drive
├── installer/
│   └── JotnarSetup.iss              Inno Setup script - produces a real Setup.exe
├── .github/workflows/
│   └── release.yml                  Builds and publishes Setup.exe + portable ZIP on tag push
└── docs/
    ├── ARCHITECTURE.md          How the application is put together internally
    ├── FEATURES.md              Full itemized list of every test/feature
    ├── BUILD.md                 Build, packaging, and USB deployment walkthrough
    ├── INSTALL.md               All four ways to install/run the tool
    └── USAGE.md                 Day-to-day usage guide for technicians
```

## Not included in this repository

A few files the tool can use are intentionally left out of version control - see
[`docs/BUILD.md`](docs/BUILD.md) for where to get them and how to add them back:

- **`wifi-config.txt`** - contains real network credentials; copy it from
  `wifi-config.example.txt` and keep it local.
- **`BatteryInfoView.exe` / `BatteryInfoView.cfg`** - a free third-party tool from NirSoft,
  launched optionally alongside the battery test. Not redistributed here; download it
  directly from NirSoft if you want this integration.
- **`keytest.exe`** - an optional third-party/internal keyboard-test utility. If it's not
  present, the keyboard test just falls back to a manual pass/fail question.
- **Compiled `.exe` files and `Runa-M.ico`** - build artifacts, regenerated by `build.bat`.

## Author

Created by **Mike**.

## License

MIT - see [`LICENSE`](LICENSE). Free to use, modify, and distribute (including
commercially), as long as the copyright notice is kept.
