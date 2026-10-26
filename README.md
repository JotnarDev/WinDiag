# WinDiag

Hardware diagnostics tool for Windows (Electron + React + Tailwind).

> Source reconstructed from the packaged `windiag-1.0.0` build (`app.asar`). The original was
> TypeScript; type annotations don't survive compilation, so this version is JavaScript/JSX with
> the same logic, text, styles and IPC channels.

## Requirements

- Windows 10/11
- Node.js 20.19+ (22 LTS recommended)

## Usage

```bash
npm install
npm run dev        # development mode with hot reload
npm run build:win  # produces dist/windiag-<version>-setup.exe
```

## Layout

```
src/
  main/              Main process (Electron, PowerShell/WMI)
    index.js           window, IPC handlers, keyboard/touch helpers
    powershell.js      shared PowerShell runner
    system-info.js     static/dynamic hardware info
    ports.js           USB and Ethernet
    other-devices.js   smart card, GPS, barcode scanner, radios, Wi-Fi
    system-tools.js    Windows tools, services, reports, elevation
    users.js           local accounts
    disk-health.js     main drive health
  preload/index.js   API exposed as window.api
  renderer/src/
    App.jsx            module navigation
    context/           SystemInfoProvider, PortsProvider
    modules/           one screen per module (Overview, Display, Touch, ...)
    components/        Sidebar and UI components (shadcn)
    assets/main.css    Tailwind v4 theme
```
