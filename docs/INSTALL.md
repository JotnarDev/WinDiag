# Installation

Four ways to get the Hardware Diagnostics Tool running, from "just try it right now"
to "install it properly on every refurbishment station."

## 1. Run it directly, no install (fastest way to try it)

Paste into a PowerShell prompt (Administrator not required - the tool elevates
itself automatically):

```powershell
irm https://raw.githubusercontent.com/JotnarDev/hardware-diagnostics-tool/main/bootstrap/Run-Jotnar.ps1 | iex
```

This downloads the latest `main` branch into a temporary folder and launches it
immediately. Nothing is installed; the only thing left behind is that temporary
download (a few hundred KB under `%TEMP%`).

Since this pulls straight from the repository, `wifi-config.txt` won't be present
(only the blank `wifi-config.example.txt` template ships in source control), so the
WiFi test will just report adapter status without attempting to auto-connect.

## 2. Install onto a USB drive, no install, no cloning

For setting up a USB drive on a machine that doesn't have (and may never need) a
local copy of the toolkit. Plug in a USB drive, then paste:

```powershell
irm https://raw.githubusercontent.com/JotnarDev/hardware-diagnostics-tool/main/bootstrap/Install-To-USB.ps1 | iex
```

This detects the USB drive (asks you to pick one if there's more than one plugged
in), downloads the repository, and copies everything needed onto the drive under a
`Diagnostico-Hardware` folder. If this machine has a C# compiler available (it does
on basically every Windows 10/11 install), it also compiles a proper
`Diagnostico-Hardware.exe` launcher for the USB drive; if not, the drive still works
fine via `Iniciar-Diagnostico.bat` (no compiling needed either way).

The resulting USB drive can then run the tool on any Toughbook, offline, no
internet connection required from that point on.

## 3. Portable ZIP (download once, run anywhere)

Every [tagged release](https://github.com/JotnarDev/hardware-diagnostics-tool/releases)
includes a `hardware-diagnostics-tool-portable.zip` asset - already built, with
`Diagnostico-Hardware.exe` included, ready to unzip onto a USB drive or any folder
and run. No compiling, no installing.

## 4. Proper installer (Setup.exe - Start Menu, uninstaller)

Every [tagged release](https://github.com/JotnarDev/hardware-diagnostics-tool/releases)
also includes `JotnarHardwareDiagnostics-Setup.exe` - a normal Windows installer
(built with [Inno Setup](https://jrsoftware.org/isinfo.php)) that installs to
Program Files, adds Start Menu (and optionally Desktop) shortcuts, and registers a
proper uninstaller under "Apps & Features". Use this for refurbishment stations
where you want the tool to behave like a normally-installed application rather than
a portable one.

Both release assets (the portable ZIP and the installer) are built and published
automatically by [`.github/workflows/release.yml`](../.github/workflows/release.yml)
whenever a version tag (`v*.*.*`) is pushed - see that file for exactly how, and
[`docs/BUILD.md`](BUILD.md) for building the installer by hand instead.

## Which one should I use?

- Just want to check the tool out once? **Option 1.**
- Setting up a USB drive to carry between Toughbooks? **Option 2** (if you have
  internet on hand) or **Option 3** (if you'd rather download once, ahead of time).
- Setting up a dedicated refurbishment workstation permanently? **Option 4.**
