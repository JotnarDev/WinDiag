# Usage Guide

A walkthrough of a typical refurbishment session, from launch to finished report.

## 1. Launch

Run `Diagnostico-Hardware.exe` (or `Iniciar-Diagnostico.bat` if you haven't compiled it).
If the tool isn't already running elevated, Windows will show a UAC prompt - accept it.

## 2. Console pre-flight

Before the window opens, a console appears showing:

1. A banner identifying the tool and version.
2. Equipment detection - Model, Serial, BIOS, CPU, RAM, Disk, one step at a time.
3. Three quick checks: Windows Update, WiFi (connects automatically using
   `wifi-config.txt` if configured), and Windows Activation.

This takes a few seconds; no input is needed. Once it says "OPENING UI", the main window
appears with the equipment panel and those three results already filled in.

## 3. Automatic tests

Click **Start Automatic Diagnostics** to run the rest of the automatic tests (drivers,
battery, Bluetooth, WWAN, optical drive, BIOS, CPU, RAM, disk, and so on). The sidebar
tiles color themselves PASS (green), FAIL (red), or WARNING (yellow) as each one finishes,
and the dashboard counters at the top update live. You can re-run any single test by
clicking its tile directly, including the three that already ran during pre-flight.

## 4. Guided tests

Click **Guided Tests** to go through the checks that need a human to actually look/listen/
touch something (camera, audio, keyboard, touch screen, and so on). Each one shows a
dialog explaining what to check and asks Yes / No / N-A. Guided tiles turn a flat blue once
answered, regardless of the answer - the checkmark just means "this one's been done";
scroll the results table to see what was actually answered.

You can also run the **Screen Test**, **Calibrate Touch Screen**, or **Sysprep** buttons in
the Equipment Info panel independently, whenever you need them - they aren't part of the
Guided Tests sequence.

## 5. Reviewing results

The results table lists every test with its status and detail text. Use the filter buttons
(All / Passed / Failed / Warnings / Info) to narrow it down. The status bar at the top
shows the computer name, current user, Windows version, date/time, and a running
total/pass/fail count.

## 6. Exporting

Three export options, all named using the detected serial number by default:

- **Save Report** - a plain-text summary.
- **Export CSV** - the same data as a `.csv`.
- **Export Excel** - appends one row to a running export file (useful if you're
  processing many units and want them all in one spreadsheet).

The first time you export (via Guided Tests completion, Export Excel, or closing the
window with unexported results), the tool asks once: **"Is this service tied to a work
order?"** Answer yes to enter an order/ticket number, or no to skip it - either way, you
won't be asked again this session.

## 7. Finishing up

**Finish & Restart** restarts the computer (with a confirmation prompt) - useful as the
last step before handing the unit off. **Close** exits the tool; if you have unexported
results, it'll offer to export them first.

## Switching language

Click **EN** / **ES** in the header at any time - every label, dialog, and result message
switches immediately, no restart needed.
