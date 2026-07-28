# Features

Complete, itemized reference of everything the tool checks and does. "Auto-detected" means
the sidebar tile for that test only appears if the corresponding hardware is actually
present on the machine.

## Automatic tests (Phase 1)

Run with no technician interaction - either during the console pre-flight (Windows Update,
WiFi, Windows Activation) or all together via "Start Automatic Diagnostics".

| Test | What it checks | Auto-detected |
|---|---|---|
| Windows Update | Stops and disables the `wuauserv` service | Always shown |
| WiFi | Connects to the configured SSID (see `wifi-config.txt`) if not already connected, reports adapter enabled/connected status | Only if a physical wireless adapter is present |
| Windows Activation | Queries `SoftwareLicensingProduct` for an active Windows license | Always shown |
| Drivers | Scans PnP devices for driver error codes | Always shown |
| Driver Versions | Compares installed driver versions against `$Global:DriversEsperados` (empty by default - fill in your own list) | Always shown |
| Battery | Charge %, status, and health via `Win32_Battery` | Only if a battery is detected (desktops skip this) |
| Bluetooth | Detects and enables the Bluetooth radio, lists nearby/paired devices | Only if Bluetooth hardware is present |
| WWAN | Detects a cellular/mobile broadband adapter | Only if a WWAN adapter is present |
| Optical Drive | Detects and ejects the tray on any physical optical drive | Only if a physical drive is present |
| BIOS | Reports BIOS version | Always shown |
| CPU | Model, cores, threads | Always shown |
| RAM | Installed capacity, module count, speed | Always shown |
| Disk | Model, serial, capacity, free space | Always shown |

Two more tests (Uptime, GPU/Display) exist in the code but are commented out of the
catalog - uncomment their lines in `$Global:CatalogoPruebasAutomaticas` to re-enable them.

## Guided tests (Phase 2)

Each one walks the technician through a manual check and records a Pass/Fail/N-A answer.

| Test | What the technician is asked to do | Auto-detected |
|---|---|---|
| USB | Plug a drive into every physical port, report how many worked | Only if a USB controller is present |
| DVD | Insert a disc, confirm it's read correctly | Only if a physical optical drive is present |
| Camera | Confirm the camera image displays correctly | Only if a camera is present |
| Audio | Confirm the test tone plays on left then right speaker | Only if an audio device is present |
| Microphone | Confirm the input level indicator reacts to speech | Only if an audio device is present |
| Keyboard | Runs a dedicated key-test tool if present (`keytest.exe`), otherwise a manual key-press check | Only if a keyboard is present |
| Touchpad | Confirm movement and clicks work | Only if a touchpad is present |
| Touch Screen | Confirm touch response | Only if touch hardware is present |
| Biometric Reader | Confirm the fingerprint/biometric reader works | Only if present |
| SmartCard Reader | Confirm the SmartCard reader works | Only if present |
| Barcode Reader | Confirm the barcode/scanner works | Only if present |
| GPS | Confirm GPS works | Only if present |
| Stylus | Confirm the digital pen works | Only if a digitizer/pen is present |
| Ports | Confirm any remaining physical ports (e.g. audio jack) work | Always shown |

Screen Test used to live in this list; it's now a standalone button (see below) since it
needed its own full-screen window rather than a simple dialog question.

## Equipment Info panel

Always visible in the sidebar, queried live via WMI/CIM:

- Model, Serial (BIOS serial with fallback to the system product's identifying number),
  BIOS version, CPU (name + core/thread count), RAM (total + per-module manufacturer/serial),
  Disk (capacity, brand, model, serial).
- **Calibrate Touch Screen** button - launches Windows' built-in `tabcal.exe`.
- **Screen Test** button - opens a dedicated full-screen color/backlight test
  (white/black/red/green/blue/50% gray) with on-screen brightness control, and asks the
  technician to confirm no dead pixels, discoloration, or backlight issues.
- **Sysprep** button - launches `sysprep.exe` after a confirmation dialog (this resets the
  Windows installation for imaging and cannot be undone).

## Reporting

- **Save Report** - plain-text summary of every result, named after the detected serial
  number (or the computer name if no serial was detected).
- **Export CSV** - same data as a `.csv` file.
- **Export Excel** - appends one row (Order, unit number, serial, disk info, RAM x2,
  battery x2, comment) to a running export file.
- **Work order prompt** - asked once, at the end of the session (whichever finishing action
  happens first: Guided Tests completion, manual Excel export, or closing the window):
  "Is this service tied to a work order?" If yes, the order number is requested and
  included in the export; if no, that field is simply left blank.

## Utility

- **Language toggle** (EN/ES) in the header - switches every label instantly.
- **Finish & Restart** - restarts the computer, with a confirmation dialog.
- **USB Installer** (`InstaladorUSB.exe` / `Instalar-USB.ps1`) - copies the compiled
  toolkit (the `.exe`, the `.ps1`, and any present helper tools/config) onto a USB drive
  chosen by the technician, so the tool can run from any Toughbook without reinstalling.
