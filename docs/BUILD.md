# Build & Deployment

## Folder layout requirement

Everything under [`app/`](../app/) is meant to stay **flat, in one folder** - this isn't
just tidiness, it's how the tool actually finds its own files at runtime:

- `Diagnostico-Hardware.exe` (once built) looks for `Diagnostico-Hardware.ps1` in its own
  folder (`AppDomain.CurrentDomain.BaseDirectory`).
- `build.bat` reads `Launcher.cs`/`app.manifest`/`InstaladorUSB.cs`/`Instalar-USB.ps1` from
  its own folder (`%~dp0`) and writes the compiled `.exe` files back into that same folder.
- `Instalar-USB.ps1` looks for `Diagnostico-Hardware.exe`/`.ps1` and its optional helper
  tools (`keytest.exe`, `BatteryInfoView.exe`/`.cfg`, `wifi-config.txt`, `Runa-M.ico`) all
  next to itself (`$PSScriptRoot`).

If you reorganize this folder, you'll need to update the path logic in `Launcher.cs`,
`build.bat`, and `Instalar-USB.ps1` to match - it's not just a matter of moving files.

## Setting up WiFi credentials

1. Copy `app/wifi-config.example.txt` to `app/wifi-config.txt` (same folder).
2. Fill in your network's `SSID=` and, if it isn't already saved as a Windows profile,
   `Password=`.
3. `app/wifi-config.txt` is listed in `.gitignore` - it will never be committed. Only
   `wifi-config.example.txt` (blank template) is tracked in source control.

If `wifi-config.txt` is missing entirely, or its `SSID=` line is left blank, the WiFi test
simply skips the auto-connect step and only reports the adapter's enabled/connected status.

## Running without compiling anything

Double-click `app/Iniciar-Diagnostico.bat`, or run directly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "app\Diagnostico-Hardware.ps1"
```

The script detects on its own whether it needs Administrator rights or STA mode and
relaunches itself accordingly - no manual "Run as Administrator" needed.

## Building the native launchers

Requires .NET Framework 4.x's `csc.exe`, which ships with every Windows 10/11 install (no
download needed). From inside `app/`, run:

```
build.bat
```

This will:

1. Locate `csc.exe` (checks both the 64-bit and 32-bit `Framework` paths under `%WINDIR%`).
2. Generate `Runa-M.ico` (via `Crear-Icono.ps1`) - a small dark badge icon with the Mannaz
   rune, used for both compiled `.exe` files. If icon generation fails for any reason, the
   build continues without a custom icon.
3. Compile `Launcher.cs` (with `app.manifest` embedded, so it requests Administrator via
   UAC automatically) into `Diagnostico-Hardware.exe`.
4. If `InstaladorUSB.cs` and `Instalar-USB.ps1` are both present, compile
   `InstaladorUSB.exe` too (no admin manifest needed - copying files to a USB drive doesn't
   require elevation).

After building, keep `Diagnostico-Hardware.exe` next to `Diagnostico-Hardware.ps1` (and
`InstaladorUSB.exe` next to `Instalar-USB.ps1`) - the launchers won't find their scripts
otherwise.

## Deploying to a USB drive

Once built, plug in a USB drive and run `InstaladorUSB.exe`. It will:

1. Detect connected USB drives (prompts you to choose if there's more than one).
2. Create a `Diagnostico-Hardware` folder on the drive.
3. Copy `Diagnostico-Hardware.exe`/`.ps1` (required) plus any of `keytest.exe`,
   `BatteryInfoView.exe`/`.cfg`, `wifi-config.txt`, `Runa-M.ico` that happen to be present
   (all optional).

The resulting USB drive can run the tool on any Toughbook without installing anything.

## Optional third-party / bundled tools

These are **not included** in this repository - if you want the integration, obtain your
own copy and drop it into `app/` (it'll be picked up automatically, and `.gitignore` keeps
it from being committed back):

- **`BatteryInfoView.exe` / `BatteryInfoView.cfg`** - a free battery-diagnostics utility
  from [NirSoft](https://www.nirsoft.net/). Launched optionally alongside the Battery test
  if present. Check NirSoft's license terms before redistributing it yourself.
- **`keytest.exe`** - an optional keyboard-test utility. If absent, the Keyboard guided
  test falls back to asking the technician to manually press a few keys.

## Building the Setup.exe installer

`installer/JotnarSetup.iss` is an [Inno Setup](https://jrsoftware.org/isinfo.php) script
that packages the already-built `app/` output into a real Windows installer - Program
Files, Start Menu shortcuts, and a proper uninstaller. To build it by hand:

1. Run `app/build.bat` first, so `Diagnostico-Hardware.exe` and `Runa-M.ico` already exist.
2. Install Inno Setup (free) if you don't have it.
3. Open `installer/JotnarSetup.iss` in Inno Setup and click **Compile**, or run
   `ISCC.exe installer\JotnarSetup.iss` from the command line.
4. The finished installer is written to `dist/JotnarHardwareDiagnostics-Setup.exe`.

You don't normally need to do this by hand - see below.

## Automated releases (GitHub Actions)

[`.github/workflows/release.yml`](../.github/workflows/release.yml) does the entire
build for you on GitHub's own Windows runners: it compiles both `.exe` launchers,
builds the Inno Setup installer, packages a portable ZIP of `app/`, and publishes both
as assets on a GitHub Release. To cut a release:

```
git tag v3.0.0
git push origin v3.0.0
```

Pushing a tag matching `v*.*.*` triggers the workflow automatically. You can also run
it manually from the Actions tab (`workflow_dispatch`) to sanity-check the build
without publishing a tagged release - in that case the build output is attached to
the workflow run itself as a downloadable artifact instead of a Release.

See [`docs/INSTALL.md`](INSTALL.md) for the four end-user ways to install/run the tool,
including the two one-liner `bootstrap/` scripts that pull straight from this repository.

## Notes for a public repository

If you're publishing this repository publicly, double-check before your first push that:

- `app/wifi-config.txt` (if you created one locally) is not staged - `.gitignore` covers
  it, but a `git add -A` after `git init` can sometimes surprise you if the file was
  already tracked from an earlier commit.
- No compiled `.exe` files, `Runa-M.ico`, or the optional third-party tools listed above
  got committed - `.gitignore` excludes them, but it's worth a `git status` check.
- `$Global:DriversEsperados` (in the `Variables` region of `Diagnostico-Hardware.ps1`) and
  any comments you've added don't reference internal file paths, employee names, or other
  information you don't want public.
