# Changelog

WinDiag Fluent follows [Semantic Versioning](https://semver.org/):

- **Major**: a redesign or a change that breaks how the app is used (2.0.0 was the move to Fluent).
- **Minor**: a new feature or page. Resets the patch number.
- **Patch**: a fix to something that already existed.

## 2.5.0 — 2026-10-29

### Added
- Settings → About expands to show the changes in every version (read from this changelog).

## 2.4.0 — 2026-10-29

### Added
- Color palettes in Settings → Appearance: Windows (system accent), Ocean, Forest, Sunset, Grape, Slate, and Custom with its own accent color and optional background tint.

## 2.3.4 — 2026-10-29

### Fixed
- Windows activation wasn't shown on some devices: the query listed every license and timed out. It now asks only for the Windows license, runs separately and shows "Checking activation…" meanwhile.

## 2.3.3 — 2026-10-29

### Fixed
- The Windows Update switch now reflects the real service (running, startup type) and refreshes every few seconds. Before, it only looked at WinDiag's policy, so it showed Off when Windows had turned the service back on.

## 2.3.2 — 2026-10-29

### Fixed
- "Update BIOS…", "Create catalog…" and the catalog "Browse…" button failed with "launchBiosUpdate is not defined" (missing import).

## 2.3.1 — 2026-10-29

### Fixed
- Panasonic models are shown by their usual name ("FZ55-1" → "FZ-55 MK1"), with the raw model ID kept below it.
- BIOS updates now match models written without the hyphen ("FZ-55" matches "FZ55-1") and are only offered when the model's generation matches the BIOS line (MK1 = V1.xx).

## 2.3.0 — 2026-10-29

### Added
- BIOS updates on the Drivers page, from the catalog's "bios" list. WinDiag checks the AC adapter, suspends BitLocker for one restart and starts the manufacturer's updater. It only offers a BIOS from the same generation (Panasonic V1 = MK1, V2 = MK2…).

## 2.2.0 — 2026-10-29

### Added
- Driver catalog (.json): compare with one file instead of reading every INF, which helps when the drivers are on a server. You set the path in Settings → Drivers, and "Create catalog…" builds the file from a folder.

## 2.1.0 — 2026-10-29

### Added
- Drivers page: compares the installed drivers with a driver folder ("02 Drivers") and installs newer or missing ones with pnputil.

## 2.0.0

### Changed
- New Fluent (Windows 11) design: navigation pane, Mica, light/dark theme and a Settings page.
- Users: any account except the built-in ones can be deleted, with the same warnings as Local Users and Groups.
