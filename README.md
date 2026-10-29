# WinDiag Fluent

A diagnostics and setup tool for Windows computers, with a Fluent (Windows 11) design. A technician uses it to test a computer's hardware, install drivers and BIOS updates, and get the machine ready for delivery. It is built mainly for rugged laptops: Panasonic Toughbook, Getac and Dell Latitude Rugged.

- **Current version:** 2.5.0. The changes in each version are listed in [CHANGELOG.md](CHANGELOG.md) and inside the app, under Settings → About.
- **Author:** JOTNAR.
- **Stack:** Electron 44 · electron-vite 5 · React 19 · Tailwind CSS 4 · Fluent UI icons · systeminformation.

> If you are an AI or a developer taking over the project, also read [HANDOFF.md](HANDOFF.md). It explains how each version was built, the decisions made and the working rules.

---

## Contents

1. [Features](#features)
2. [Requirements](#requirements)
3. [Usage](#usage)
4. [Drivers, catalog and BIOS](#drivers-catalog-and-bios)
5. [Settings](#settings)
6. [Development](#development)
7. [Project structure](#project-structure)
8. [Versioning](#versioning)
9. [Troubleshooting](#troubleshooting)
10. [License](#license)

---

## Features

The app has a navigation pane with three groups of pages.

### Overview

A spec sheet of the computer:
- manufacturer, model and serial number;
- processor, memory (per module), storage, graphics, battery, BIOS and Windows;
- Windows activation status;
- a **Copy specs** button that copies the sheet as text (useful for tickets).

On Panasonic machines it shows the name technicians use. For example, `FZ55-1` is shown as **FZ-55 MK1**, with the original code below it.

### Hardware tests

| Page | What it tests |
|---|---|
| **Display** | Fills the screen with solid colors to find dead or stuck pixels, light bleed and uneven backlight. |
| **Touch** | Draws the trail of each touch point to check accuracy, continuity and multi-touch. Shows how many simultaneous touches are detected and blocks Windows edge gestures during the test. |
| **Keyboard & mouse** | Press every key and every mouse button. Keys are recognized by physical position, so it works with any keyboard layout. While the test is in the foreground, it blocks the Windows key, Print Screen, Esc, Alt+Tab and the lock keys (this can be turned off in Settings). |
| **Audio & camera** | Camera preview, microphone level and a test tone for each speaker channel. |
| **Battery** | Charge, status, health (design capacity vs. actual capacity), cycle count, charge history and details for each battery. |
| **Disk health** | Estimates the remaining life of the main disk from Windows reliability counters: wear, temperature, power-on hours and errors. |
| **USB ports** | Detects the computer's USB-A and USB-C ports and checks that each one recognizes a device. |
| **Wireless & peripherals** | Wi-Fi, Bluetooth, mobile broadband (4G), smart card reader, GPS and barcode/QR scanner, when the computer has them. |

### Tools

**Technician tools**
- **Windows Update:** a switch that turns it off persistently (through policies and the service). It shows the real state of the service and refreshes on its own.
- **Activation:** activation status and a button to enter or change the product key.
- **Reports:** battery health report (`powercfg /batteryreport`) and energy efficiency report (`powercfg /energy`).
- **Maintenance:** memory diagnostics and a disk check (`chkdsk`) scheduled for the next restart.
- **Windows utilities:** shortcuts to Sysprep, Device Manager, System Information, DirectX Diagnostic, Event Viewer, Resource Monitor, Disk Management, Optimize Drives, Disk Cleanup, System Configuration, System Restore, Programs and Features, Network Connections and Tablet PC calibration.

**Drivers**
- Compares the installed drivers with a driver folder or a `.json` catalog, and installs newer or missing ones.
- Compares the BIOS with the one in the catalog and launches the manufacturer's updater.
- Explained in detail in [Drivers, catalog and BIOS](#drivers-catalog-and-bios).

**Users**
- Lists the local Windows accounts.
- Lets you delete any account except the built-in ones (Administrator, Guest…), with the same warnings as *Local Users and Groups*.
- Requires Sysprep to be open. The account's profile is kept on disk.

---

## Requirements

**To use the app**
- Windows 10 or 11, 64-bit.
- Administrator rights: the app asks for them through UAC when it starts.
- Transparency (Mica) needs Windows 11 22H2 or later. On older versions the background is solid.

**To develop**
- Node.js 20.19 or later (22 LTS recommended).
- npm.

---

## Usage

### Portable version (zip)

1. Extract `WinDiag Fluent-X.Y.Z-win.zip` to any folder or to a USB drive.
2. Run `windiag-fluent.exe` and accept the UAC prompt.

No installation is needed. Settings are saved in a `settings.json` file inside the app's data folder, under `%APPDATA%`.

### Shortcuts

| Where | Key | Action |
|---|---|---|
| Display | **→** / **Space** · **←** | Next color / previous color |
| Touch | **Space** | Clear the strokes |
| Display / Touch | **Esc** | Exit the full-screen test |
| Navigation pane | **Esc** | Close the pane when it is in overlay mode |

---

## Drivers, catalog and BIOS

### Compare with a folder

1. The app looks for a `02 Drivers` folder at the root of every drive, or you can pick another one with **Browse…**.
2. **Compare drivers** reads every `.inf` in the folder (folders ending in `- OLD` are skipped). Then it compares their hardware IDs and versions with the computer's devices.
3. Results are shown in three groups:
   - **Updates available:** with **Update** per device and **Update all**.
   - **Missing drivers:** devices without a driver.
   - **Up to date.**
4. Installation uses `pnputil /add-driver <inf> /install`. Afterwards the app reads the device's version again and tells you if Windows kept another driver it considers better, or if a restart is needed.

Only `.inf` drivers can be compared. `.exe` or `.zip` installers are skipped.

### `.json` catalog (recommended for servers)

Reading hundreds of `.inf` files over the network is slow. The catalog is a single file that lists the drivers, so the app only goes back to the server to install.

- **Create or update:** on the Drivers page, **Create catalog…** scans the folder and saves `drivers-catalog.json`, by default inside that same folder.
- **Use:** in **Settings → Drivers → Driver catalog**, type the path or pick it with **Browse…**.
- **Network path:** use the full path `\\server\share\02 Drivers\drivers-catalog.json`. Mapped drive letters (Z:, etc.) do not work because the app runs as administrator. If the share needs credentials, save them in Windows Credential Manager.

Format:

```json
{
  "format": 1,
  "arch": "x64",
  "root": "",
  "generated": "2026-10-29",
  "bios": [],
  "drivers": [
    {
      "path": "Panasonic\\FZ-55\\Video\\iigd_dch.inf",
      "description": "Intel(R) Iris(R) Xe Graphics",
      "provider": "Intel Corporation",
      "class": "Display",
      "version": "31.0.101.5186",
      "date": "2024-01-10",
      "hardwareIds": ["PCI\\VEN_8086&DEV_9A49"]
    }
  ]
}
```

- **`root`:** the driver folder. If it is empty, paths are relative to the folder that contains the `.json`.
- **Editing by hand:** you can add or remove entries. Entries without `path`, `version` or `hardwareIds` are ignored. Copy hardware IDs from Device Manager → Properties → Details → *Hardware Ids*.

### BIOS

BIOS updates are `.exe` installers, so they are compared using the catalog's `bios` list:

```json
{
  "manufacturer": "Panasonic",
  "model": "CF-33",
  "sku": "",
  "version": "V2.00L24",
  "installedPrefix": "V2.",
  "path": "Panasonic\\CF-33\\CF-33 MK2\\BIOS_33_V200L24.exe",
  "arguments": "",
  "notes": ""
}
```

| Field | Meaning |
|---|---|
| `model` | Matched against the start of the Windows model, ignoring dashes and spaces (`FZ-55` matches `FZ55-1`). |
| `sku` | Optional. Must appear in the system SKU; use it to tell sub-models apart. |
| `version` | The version the updater installs. `V200L24` and `V2.00L24` are equivalent. If empty, the entry is ignored. |
| `installedPrefix` | Optional. How the installed version must start for the update to be offered. |
| `path`, `arguments` | The updater (`.exe`, `.cmd` or `.bat`) and its parameters. |

**Panasonic generations:** the first number of the BIOS version is the generation (`V1.` = MK1, `V2.` = MK2), and the Windows model ends with it (`FZ55-1` = MK1). The app only offers a BIOS when both match, so it never suggests a BIOS for a different generation.

**Before launching the updater, the app:**
- refuses if the computer is running on battery only;
- suspends BitLocker for one restart, so it does not ask for the recovery key;
- asks for confirmation.

The manufacturer's updater shows its own window and is the one that restarts the computer.

**Create catalog…** adds as BIOS entries the `.exe` files it finds in folders with "BIOS" in their name, and takes the version from the file name. When saving over an existing catalog, it keeps the BIOS entries that were already there. **Always review the generated BIOS entries before using them.**

---

## Settings

| Option | Values | Default |
|---|---|---|
| App theme | Use system setting / Light / Dark | System |
| Transparency effects | Mica on or off (Windows 11 22H2+) | On |
| Color palette | Windows, Ocean, Forest, Sunset, Grape, Slate, Custom | Windows |
| Custom accent color / background tint | Any color (Custom only) | `#0078D4` / no tint |
| Start page | Any page | Overview |
| Block system keys in the keyboard test | Yes / No | Yes |
| Driver catalog | Path to the `.json` (local or `\\server\...`) | Empty (reads the folder) |

- **Reset settings** restores every default value.
- Settings → About shows the version and, when expanded, the changes in each version.

---

## Development

```bash
npm install
npm run dev          # development mode with hot reload
npm run build        # builds main, preload and renderer into out/
```

Build the Windows version:

```bash
# portable zip → dist/WinDiag Fluent-<version>-win.zip
npx electron-vite build && npx electron-builder --win zip --x64

# NSIS installer → dist/windiag-fluent-<version>-setup.exe
npm run build:win
```

**Notes:**
- **Building on Linux:** the Windows zip is generated the same way. The app only works on Windows, because almost everything uses PowerShell and WMI.
- **Developing on another OS:** Windows features return "not supported" or empty data.
- **Package:** the `.exe` asks for administrator rights (`requestedExecutionLevel: requireAdministrator`) and only includes the Chromium locales `en-US`, `es` and `es-419`, to reduce size.
- **Low-spec machines:** the app targets computers with 4 GB of RAM and 150 % display scaling. Avoid persistent processes and heavy dependencies, and test the canvas and touch at DPR 1.5.

---

## Project structure

```
src/
  main/                         Main process (Node/Electron)
    index.js                    window, Mica, accent color, IPC (handle() validates the sender)
    powershell.js               shared PowerShell session and isolated runs
    settings.js                 settings.json with schema validation
    system-info.js              spec sheet, live data, activation
    system-tools.js             Windows Update, reports, elevation, Sysprep, chkdsk
    drivers.js                  scanning, pnputil, BIOS, catalog creation
    inf-parser.js               .inf reader (pure functions)
    driver-catalog.js           JSON catalog, BIOS, versions (pure functions)
    device-model.js             Panasonic model names (pure functions)
    keyboard-hook.js            low-level keyboard hook (C# through PowerShell)
    users.js                    local accounts
    ports.js                    USB ports
    other-devices.js            radios, smart card, GPS, scanner
    disk-health.js              main disk health
    edge-gestures.js            blocks edge gestures during the touch test
  preload/index.js              window.api: one method per IPC channel
  renderer/src/
    main.jsx                    applies appearance and palette before the first render
    App.jsx                     page map (MODULES)
    components/
      AppShell.jsx              title bar and navigation pane (NAV_GROUPS)
      Page.jsx
      ui/                       Button, Card/SettingsCard/Expander, InfoBar/Badge/
                                ToggleSwitch/ContentDialog, Select/TextBox
    context/                    SettingsContext, SystemInfoContext
    lib/                        palette.js, changelog.js, utils.js
    modules/                    one page per file (Overview, Drivers, Settings…)
    assets/main.css             Fluent tokens (light/dark), palette tint
CHANGELOG.md                    version history (read by Settings → About)
HANDOFF.md                      guide for whoever continues the project
electron-builder.yml            Windows packaging
```

**Add a page:**
1. Create the module in `modules/`.
2. Add it to `MODULES` (`App.jsx`) and to `NAV_GROUPS` (`AppShell.jsx`).
3. Add its id to `PAGE_IDS` in `src/main/settings.js`.

**Add a system call:**
1. `handle('channel', …)` in `src/main/index.js`.
2. The method in `src/preload/index.js`.
3. Call it from the renderer with `window.api.method()`.

---

## Versioning

The project follows [Semantic Versioning](https://semver.org/):

- **Major:** a redesign or a change that breaks how the app is used. 2.0.0 was the move to Fluent.
- **Minor:** a new feature or page. Patch goes back to 0.
- **Patch:** a fix to something that already existed.

**For every change:**
1. Bump the version with `npm version X.Y.Z --no-git-tag-version`.
2. Add the entry at the top of `CHANGELOG.md` in this format:
   ```
   ## X.Y.Z — YYYY-MM-DD

   ### Added | Fixed | Changed
   - One line per change.
   ```
   Do not change the format: Settings → About parses it to show the release notes.
3. Build the zip, which has the version in its name.

| Version | Main change |
|---|---|
| 2.5.0 | Release notes in Settings → About |
| 2.4.0 | Color palettes |
| 2.3.4 | Faster activation detection |
| 2.3.3 | The Windows Update switch reflects the real service state |
| 2.3.2 | Fix for "launchBiosUpdate is not defined" |
| 2.3.1 | Panasonic models and BIOS generation check |
| 2.3.0 | BIOS updates |
| 2.2.0 | `.json` driver catalog |
| 2.1.0 | Drivers page |
| 2.0.0 | Fluent redesign |

---

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| "Administrator permission is required…" | Run the app as administrator. The `.exe` already asks for it; if you started it some other way, use *Run as administrator* in the pane. |
| The folder or catalog on a server is not found | Use the `\\server\share\...` path, not a mapped drive letter. Check the network and the saved credentials. |
| "Windows kept version X…" when installing a driver | The driver was added, but Windows prefers the one it already has (for example, a signed OEM driver or a more specific match). This is not an error. |
| No BIOS update is offered | Check that `model`, `version` and `installedPrefix` in the catalog match the computer's generation, and that the catalog BIOS is newer than the installed one. |
| "Connect the AC adapter first" when updating the BIOS | Plug in the charger: the app never launches a BIOS update on battery only. |
| "Activation unknown" | Windows did not answer the license query. Run `slmgr /xpr` to check it manually. |
| The Windows Update switch goes back to On | Windows (the *Update Medic* service) turned the service back on. Turn it off again; the policies still block downloads. |
| System keys are not blocked in the keyboard test | Check that Settings → *Block system keys* is on. If the hook could not start, the page tells you. |

---

## License

[MIT](LICENSE).
