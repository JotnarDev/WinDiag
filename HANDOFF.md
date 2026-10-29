# WinDiag — handoff for an AI continuing the project

This file explains what changed in each version of WinDiag Fluent, how it was done and which rules to follow. Read it before touching the code. The details of each version are also in `CHANGELOG.md`, which the app shows under Settings → About.

---

## 1. What it is

WinDiag is a diagnostics and setup tool for Windows computers, mainly rugged laptops: Panasonic Toughbook (CF-19, CF-20, CF-31, CF-33, CF-54, CF-C2, FZ-55, FZ-A3, FZ-G1, FZ-M1), Getac and Dell Latitude Rugged. A technician (JOTNAR) uses it to test the hardware, install drivers and BIOS updates, and get the computer ready.

- **Stack:** Electron 44 + electron-vite 5 + React 19 + Tailwind 4. JavaScript, not TypeScript.
- **Design:** Fluent 2 / Windows 11, with icons from `@fluentui/react-icons`.
- **Windows:** the main process queries the system with PowerShell, through a shared session (`src/main/powershell.js`), and with `systeminformation`.
- **Permissions:** the app always runs as administrator (`requireAdministrator` in `electron-builder.yml`).

### Only the Fluent version is maintained

This repository (branch `main` of `JotnarDev/WinDiag`, version **2.5.0**) is the only maintained project. It was originally developed as `windiag-fluent/` on the git branch `fluent-ui`. The user only needs this version ("with Fluent it is much smoother").

It started as a copy of the original WinDiag (1.0.0, which is still on the development machine on the `windows-integration` branch). That project is no longer developed or copied to the USB drives, so **do not port changes to it**.

### Identity of the Fluent variant

- appId `com.jotnar.windiag.fluent`
- productName `WinDiag Fluent`
- executable `windiag-fluent.exe`
- `setAppUserModelId('com.jotnar.windiag.fluent')`

The identity differs from the original so both can be installed side by side.

---

## 2. Versioning (SemVer)

The user asked for these rules, and they apply to every change:

- **Major:** a redesign or a change that breaks how the app is used. **2.0.0 = the move to Fluent.**
- **Minor:** a new feature or page. Patch goes back to 0.
- **Patch:** a fix to something that already existed.

**Procedure for every change:**
1. Make the change.
2. Bump the version with `npm version X.Y.Z --no-git-tag-version`, which updates `package.json` and `package-lock.json`.
3. Add the entry at the top of `CHANGELOG.md`, following the existing format: `## X.Y.Z — YYYY-MM-DD`, then `### Added` / `### Fixed` / `### Changed` and one-line `- ` bullets. **This format must not change:** `src/renderer/src/lib/changelog.js` parses it with a regex to show it in Settings → About.
4. Build locally if needed: `npm run build:win` creates `dist/windiag-fluent-X.Y.Z-setup.exe` and `dist/windiag-fluent-X.Y.Z-portable.zip`.
5. To publish (only when the user asks): commit, then `git tag vX.Y.Z && git push origin main vX.Y.Z`. The `Release` workflow (`.github/workflows/release.yml`) builds both files on a Windows runner and publishes them as a GitHub Release, using that version's `CHANGELOG.md` section as release notes. It fails if the tag does not match `package.json`.
6. Tell the user which version it ended up as.

`__APP_VERSION__` comes from `package.json` (through `electron.vite.config.mjs`) and is shown at the bottom of the menu and in Settings → About.

---

## 3. What changed in each version and how

### 2.0.0 — Move to Fluent (major)

The whole interface was rewritten in the Windows 11 style.

- **Window:**
  - `titleBarStyle: 'hidden'` with a 48 px `titleBarOverlay`; Windows draws the minimize, maximize and close buttons.
  - Mica (`backgroundMaterial`) when the build is ≥ 22621 and transparency is on.
  - The size comes from the screen's work area: at most 1100×760 and at least 640×480, because most computers use 150 % scaling.
- **Navigation:** `components/AppShell.jsx` holds the title bar and a NavigationView with the `NAV_GROUPS` groups: Overview, *Hardware tests* and *Tools*. Below 1008 px of width the pane becomes compact or switches to overlay. The footer has *Run as administrator*, *Settings* and the version.
- **Custom UI components, no heavy libraries:**
  - `components/ui/Button.jsx`, with accent, standard, subtle and danger variants.
  - `components/ui/Card.jsx`: Card, Section, SettingsCard (with a `stacked` prop since 2.4.0), Expander and PropertyList.
  - `components/ui/feedback.jsx`: InfoBar, Badge, ProgressBar, ProgressRing, ToggleSwitch and ContentDialog (built on the native `<dialog>`).
  - `components/ui/inputs.jsx`: Select and TextBox.
  - `components/Page.jsx`.
- **Color tokens:** in `assets/main.css`, for light and dark. Accent shades are derived with `oklch(from var(--accent) L c h)`. It also handles `forced-colors` and `prefers-reduced-motion`.
- **Settings:**
  - `src/main/settings.js` saves a JSON file in `userData/settings.json`. Its `SCHEMA` object validates each key, and anything invalid is discarded.
  - IPC: `settings:get`, `settings:update` and `settings:reset`.
  - `SettingsContext` in the renderer.
  - `main.jsx` waits for the appearance and settings before the first render, so the window does not flicker.
- **Pages:** all of them were rewritten in Fluent.
  - **Technician tools** (`ToolsModule`) was created; it groups Windows Update, activation, reports and utilities.
  - lucide-react, class-variance-authority and the shadcn components were removed.
- **Users:**
  - Any account can be deleted except the built-in ones, including the current user's. Built-in accounts are detected by the SID's RID: 500, 501, 503 and 504.
  - The same messages as Windows *Local Users and Groups* (lusrmgr) are shown.
  - Sysprep must still be open.
- **Keyboard:** `keyboard-hook.js` is a WH_KEYBOARD_LL hook in its own PowerShell process (C# through Add-Type). While the keyboard test is in the foreground, it blocks the Windows key, Print Screen, Esc, Alt+Tab and the lock keys. It includes the Right Shift fix (scan code 0x36 with the *extended* flag).

### 2.1.0 — Drivers page (minor)

Compares the installed drivers with a driver folder and installs the newer ones.

- **`src/main/inf-parser.js` (pure functions, no Electron):**
  - Reads an `.inf` in UTF-16 with or without BOM, UTF-8 or latin1.
  - Extracts `DriverVer` (resolving `%strings%`), the provider, the class and the hardware IDs from the model sections that apply to the architecture. On x64 only `NTamd64` sections count; undecorated ones are ignored, which also drops XP drivers.
- **`src/main/drivers.js`:**
  - Looks for `X:\02 Drivers` on every drive.
  - Walks the folder up to 12 levels deep and skips folders ending in `- OLD`.
  - Parses the `.inf` files with a concurrency of 8 and keeps an in-memory cache keyed by file size and date.
  - Runs **a single** PowerShell query that joins Win32_PnPEntity (hardware and compatible IDs, error code) with Win32_PnPSignedDriver (version, date, inf).
- **Matching:**
  - Compares the device's hardware IDs with the ones in the `.inf`.
  - Compatible IDs are only used if the device has no driver.
  - The newest candidate wins: first by version and, on a tie, by date.
  - Each device ends up as `outdated`, `missing` (no driver or error 28) or `current`.
- **Installation:**
  - Uses `pnputil /add-driver <inf> /install`. Exit code 3010 means a restart is needed; 259 means it was not applied.
  - Afterwards it reads the device's version again. If it did not change, it warns that Windows kept the driver it considers better.
  - **Only accepts `.inf` files found in the last scan** (`scannedInfPaths`).
- **UI (`DriversModule.jsx`):** *Updates available* (with *Update all*), *Missing drivers* and an *Up to date* expander. The last result is kept in a module-level variable, so it is not lost when switching pages.
- **IPC:** `drivers:find-default-folder`, `drivers:choose-folder`, `drivers:scan` and `drivers:install`.

### 2.2.0 — `.json` catalog (minor)

Avoids reading 440 `.inf` files over the network when the drivers are on a server.

- **`src/main/driver-catalog.js` (pure functions):** `catalogEntry`, `buildCatalog` and `parseCatalog`. The format is:

  ```json
  {
    "about": "...",
    "format": 1,
    "arch": "x64",
    "root": "",
    "generated": "YYYY-MM-DD",
    "bios": [ ... ],
    "drivers": [
      {
        "path": "rel\\a.inf",
        "description": "...",
        "provider": "...",
        "class": "...",
        "version": "1.2.3.4",
        "date": "YYYY-MM-DD",
        "hardwareIds": ["PCI\\VEN_..."]
      }
    ]
  }
  ```

  An empty `root` means paths are relative to the `.json` file's folder. Entries without path, version or hardwareIds are ignored, so the user can add or remove entries by hand.
- **Settings:** `driverCatalog` key, with a path field and a Browse… button in Settings → Drivers.
- **Drivers page:**
  - *Compare with* shows the catalog (if there is one) and the folder.
  - *Create catalog…* scans the folder and saves the `.json`, by default inside that same folder.
  - After it is created, a *Use this catalog* button appears.
- **Network paths:** use `\\server\share` instead of mapped letters, because an elevated app cannot see the drives mapped by the user. The error messages explain this.
- **Real catalog:** on the **MIKE 2** USB drive, at `02 Drivers/drivers-catalog.json` (212 drivers, 8683 IDs and 10 BIOS entries).

### 2.3.0 — BIOS updates (minor)

- BIOS updates are `.exe` files, not `.inf`, so they are only compared from the catalog's `"bios"` list:

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

- **Computer data:** the device query also returns `system` (Win32_ComputerSystem for Manufacturer, Model and SystemSKUNumber; Win32_BIOS for SMBIOSBIOSVersion and ReleaseDate).
- **Comparison:** `matchBios` and `compareBiosVersions` compare the numeric groups of the version.
- **`launchBiosUpdate(path)`:**
  - Only accepts the updater offered by the last scan.
  - Refuses if the computer is running on battery only (`si.battery()`).
  - Suspends BitLocker for one restart (`Suspend-BitLocker -RebootCount 1`). If that fails and BitLocker is on, it stops.
  - Launches the `.exe` detached (`spawn` detached). `.cmd` and `.bat` files are launched with `cmd /d /s /c`.
- **UI:** a *BIOS* card on the Drivers page and a confirmation ContentDialog with the warnings.
- **Create catalog…:** adds as BIOS entries the `.exe` files found in folders with "bios" in their name (`guessBiosEntry`). It takes the version from the file name. When saving over an existing catalog, it **keeps the BIOS entries that were already there**, because they are reviewed by hand.

### 2.3.1 — Panasonic models and generation (patch)

- **The problem:** Panasonic stores the model as `<model>-<generation>`, for example `FZ55-1` = FZ-55 MK1, `CF-33-2` = MK2 and `CF-54-3` = MK3. Also, in Panasonic BIOS versions the first number is the generation (`V1.00L31` = MK1). Files use the `V100L31` form, while Windows reports `V1.00L31`.
- **`src/main/device-model.js`:** `friendlyModel()` turns `FZ55-1` into `FZ-55 MK1`. Overview shows the friendly name with the original *Model ID* below it, and the BIOS card does the same.
- **`driver-catalog.js`:**
  - `normalizeBiosVersion()` turns `V100L31` into `V1.00L31`.
  - `normalizeModel()` keeps only letters and numbers, so `FZ-55` matches `FZ55-1`.
  - `installedPrefix` requires the installed BIOS to start with that text.
  - **Double check:** the model's generation (`-1`) must match the one in `installedPrefix` (`V1.`). If anything does not match, no BIOS is offered.

### 2.3.2 — `launchBiosUpdate is not defined` error (patch)

- **Cause:** Prettier had collapsed the `import { … } from './drivers'` in `src/main/index.js` onto a single line. A later change searched for the multi-line form, did not find it and was not applied. `launchBiosUpdate`, `chooseCatalogFile` and `createCatalog` were missing.
- **Lesson:** after editing with scripts, verify that every replacement was applied (with an `assert`) and run the undefined-names check from section 5.

### 2.3.3 — Windows Update switch (patch)

- **Before:** the state was based on the `NoAutoUpdate` policy and was read only once. If Windows (*Update Medic*) turned the service back on, the switch still said Off.
- **Now:**
  - `getWindowsUpdateState()` returns `{ state, running, startType, policy }` and reports *Off* only if the service is stopped **and** set to Disabled.
  - `ToolsModule` polls it every 5 s while the page is open, and pauses polling while applying a change.
  - It shows details such as "Service running · startup Manual · blocked by policy".
- **How Windows Update is turned off (unchanged):**
  - Policies in `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate` (NoAutoUpdate, UseWUServer, a fake WUServer at 127.0.0.1, DoNotConnect…).
  - Plus `sc config wuauserv start= disabled` and `net stop`.

### 2.3.4 — Activation detection (patch)

- **Before:** the query listed every `SoftwareLicensingProduct` and filtered them in PowerShell. It took more than 10 s, the timeout killed it and activation stayed empty.
- **Now:**
  - A WQL query filtered in WMI: `ApplicationID='55c92734-…' AND PartialProductKey IS NOT NULL`, with a 60 s timeout.
  - It runs through a separate IPC, `system:get-activation`, and `SystemInfoContext` puts the result into `os.activated` when it arrives.
  - Until then, `os.activated` is `undefined` and the app shows "Checking activation…". The value `null` means "Activation unknown".

### 2.4.0 — Color palettes (minor)

- **`src/renderer/src/lib/palette.js`:**
  - `PALETTES`: Windows (the system accent), Ocean, Forest, Sunset, Grape, Slate and Custom.
  - `applyPalette()` sets `--accent` and, if there is a tint, `--tint` and `data-tint` on `<html>`.
- **CSS:** `html[data-tint]` mixes the tint into `--solid-bg` and `--flyout` with `color-mix`. With Mica, the tint is applied as a layer on top.
- **Settings:** keys `palette`, `customAccent` and `customTint` (`''` = no tint). The UI uses radio-style swatches, and Custom adds an `<input type=color>` that previews live and saves 400 ms after release.
- **When it is applied:** in `main.jsx` before the first render, in `SettingsContext` when settings change, and when the Windows accent color changes.

### 2.5.0 — Release notes in About (minor)

- Settings → About is now an Expander that lists every version. `lib/changelog.js` imports `CHANGELOG.md?raw` and parses it.

---

## 4. Code structure (Fluent)

```
src/main/
  index.js          window, appearance (Mica/accent), IPC (handle() validates the sender)
  powershell.js     shared PowerShell session (runPowerShell) and isolated runs
  settings.js       settings.json with SCHEMA
  system-info.js    static/dynamic specs, activation
  system-tools.js   Windows Update, reports, elevation, sysprep, chkdsk
  drivers.js        scanning, pnputil, BIOS, catalog creation
  inf-parser.js     .inf parser (pure)
  driver-catalog.js JSON catalog, BIOS, versions (pure)
  device-model.js   Panasonic names (pure)
  users.js, ports.js, other-devices.js, disk-health.js, edge-gestures.js, keyboard-hook.js
src/preload/index.js  window.api (each method = one IPC channel)
src/renderer/src/
  App.jsx (MODULES map), main.jsx, components/, context/, lib/, modules/
```

**To add a page:**
1. A module in `modules/`.
2. An entry in `MODULES` (`App.jsx`) and in `NAV_GROUPS` (`AppShell.jsx`).
3. Its id in `PAGE_IDS` in `settings.js`.

**To add an IPC call:**
1. `handle('channel', …)` in `index.js`.
2. The method in `preload/index.js`.
3. The `window.api.method()` call in the renderer.

---

## 5. How the work was done

- **Development happens on Linux**, so nothing Windows-specific was tested on Windows: Mica, the keyboard hook, pnputil, the BIOS updater, BitLocker, Windows Update, deleting users, etc. The user tests on the computers and reports back.
- **Build:** `npm run build:win` produces the installer (`dist/windiag-fluent-X.Y.Z-setup.exe`) and the portable zip (`dist/windiag-fluent-X.Y.Z-portable.zip`). Official builds come from the GitHub Actions `Release` workflow, not from local builds. The copy on the USB drive has no `node_modules`: run `npm install` first. On the development machine, `node_modules/electron/dist` had a manually downloaded Linux Electron, used only for screenshots.
- **Visual review:** an Electron script loads `out/renderer` with mocked IPC and takes screenshots in light mode, dark mode and at different widths. It is not in the repo; it lived in the session's scratchpad.
- **Undefined-names check:** ESLint with only the `no-undef` rule over `src`. It is also checked that every `window.api.X` in the renderer exists in the preload and that every channel has its `handle`.
- **Formatting:** Prettier (repo config). Careful: it can join or split imports and break a find-and-replace.
- **Pure function tests:** `inf-parser`, `driver-catalog` and `device-model` were tested with Node against the real driver folder and with Panasonic cases.

---

## 6. User rules and preferences

- The user writes in Spanish and is answered in Spanish. **App text is in English.**
- **Commit only when the user asks** ("haz el commit"). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The git user is `jotnar`.
- Confirm before deleting or overwriting, and check the target first.
- **Target computers:**
  - almost all use 150 % scaling (test canvas and touch at DPR 1.5);
  - they may have only 4 GB of RAM, so no persistent processes or heavy dependencies.
- **"MIKE 2" USB drive** (`/media/jotnar/MIKE 2` on Linux):
  - **It is the working drive.** Builds are stored there following its `LEEME - Organizacion.txt`.
  - `01 Diagnostico y Utilidades/WinDiag (App) - ACTUAL <date>` is the version in use, and `Abrir WinDiag.bat` launches it.
  - `04 Desarrollo y Pruebas/WinDiag - Build de prueba <date>` holds untested builds.
  - Old items are renamed with the " - OLD" suffix.
  - Do not touch ACTUAL or the `.bat` unless the user asks, and log every change in the LEEME.
- **Never touch `sdb`:** it is the Linux system disk.

---

## 7. Pending / untested

- **Untested on Windows:** everything in the 2.x versions, especially pnputil installation, the BIOS updater, BitLocker, network paths, the Windows Update switch, activation and Mica with a tint.
- **Catalog to review:**
  - CF-C2 has two V2 BIOS files (`V2.00L21` and `V2.50L16`); confirm whether V2.50 is for another sub-model and, if so, use `sku`.
  - `ec_33_1_m195057.exe` and `BiosUpdate_R18-0354.exe` have no version, so they are ignored.
- **Open questions for the user:**
  - Store the app's data in a `data` folder next to the exe (portable mode)?
  - Remove the Sysprep requirement for deleting users?
