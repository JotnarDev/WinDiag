# Architecture

This document describes how `app/Diagnostico-Hardware.ps1` is put together internally.
It's a single ~4,000-line PowerShell script, organized into six `#region` blocks:
`Variables`, `Funciones`, `Pruebas Automaticas`, `Pruebas Interactivas`, `GUI`, `Main`.

## Why a single file

The tool has to run on refurbishment-line laptops with nothing pre-installed beyond
Windows and PowerShell itself - no module gallery access, no build step required to just
try it. A single `.ps1` (plus the optional compiled launcher) can be copied to a USB drive
and run immediately. This trades off some code organization niceties for zero-dependency
portability.

## UI: WPF via XAML string, not WinForms

The main window is defined as an in-memory XAML string, parsed with
`[Windows.Markup.XamlReader]::Load()`, rather than built up imperatively. Every named
element (`Name="..."` in the XAML) is retrieved once via `$ventana.FindName(...)` right
after loading and stored in a single global hashtable, `$Global:UI`. From then on, every
function that needs to touch the UI reads/writes through `$Global:UI.SomeControl` instead
of holding its own reference. This makes it trivial to guard any UI update with
`if ($Global:UI -and $Global:UI.Whatever) { ... }` - which matters because several
functions (equipment detection, the WiFi/Update/Activation tests) are designed to run
*before* the window exists, during the console pre-flight (see below).

`Show-VentanaPrincipal` is the function that builds the XAML, populates `$Global:UI`, wires
every button's `Add_Click` handler, and finally calls `$ventana.ShowDialog()`.

## Bilingual text system

Every user-facing string is looked up through a `Tx` helper function:

```powershell
Tx "Dialog.SysprepConfirm"
Tx "Progress.Running" $contador $pruebas.Count $clave   # positional {0}/{1}/{2} substitution
```

`$Global:Textos` is a hashtable of two hashtables (`"EN"` and `"ES"`), keyed by a stable,
language-independent string. `$Global:Idioma` holds the active language ("EN" by default);
switching it and calling `Update-IdiomaUI` refreshes every static label in the window
without rebuilding it. If a key is missing from the active language, `Tx` falls back to
English, and if it's missing there too, it just returns the key itself - the UI can never
crash from a missing translation.

Component/category names (the `Componente` field on every result, e.g. `"Windows Update"`,
`"Battery"`) are intentionally kept in English in both languages, since they double as
internal matching keys for filtering results and for the Excel export - only the
human-readable detail text and dialog copy actually get translated.

## Test catalogs: the single source of truth

Two ordered hashtables define literally every test the tool knows how to run:

```powershell
$Global:CatalogoPruebasAutomaticas = [ordered]@{
    "Windows Update" = @{ TxKey = "Side.WindowsUpdate"; Accion = { Test-WindowsUpdateService }; Patrones = @("Windows Update") }
    "WiFi"           = @{ TxKey = "Side.WiFi"; Accion = { Test-Wifi }; Patrones = @("WiFi"); Detectar = { ... } }
    # ...
}
$Global:CatalogoPruebasGuiadas = [ordered]@{
    "USB" = @{ TxKey = "Side.USB"; Accion = { Test-USB-Interactivo }; Patrones = @("USB"); Detectar = { ... } }
    # ...
}
```

Each entry has:
- **`TxKey`** - the translation key for its sidebar label.
- **`Accion`** - a scriptblock that runs the actual test and calls `Add-Result`.
- **`Patrones`** - wildcard pattern(s) matched against `Componente` to compute this test's
  aggregate PASS/FAIL/WARNING/INFO status and to clear old results before a re-run.
- **`Detectar`** (optional) - a scriptblock returning `$true`/`$false` for whether this
  hardware is even present. If it returns `$false`, the sidebar tile for that test is never
  built (`Initialize-PanelSidebar` skips it via `Test-ComponenteDetectado`). This is why a
  machine with no Bluetooth radio never shows a Bluetooth tile at all.

Both the "run everything" pipelines (`Invoke-PruebasAutomaticas`, `Invoke-PruebasInteractivas`)
and the individually-clickable sidebar tiles iterate these same catalogs - there's exactly
one place that defines what a test does and how its result is judged.

## Running and recording a test

`Invoke-PruebaMedida -Nombre -Accion -Patrones` is the common execution wrapper: it clears
any previous results matching `Patrones` (so re-running a test replaces its old outcome
instead of stacking on top of it), times the run, and calls the `Accion` scriptblock inside
a try/catch. Every test function ultimately calls `Add-Result -Componente -Estado -Detalle`,
which appends a `PSCustomObject` to the plain array `$Global:Resultados` and echoes a
colored line to the console. `Add-Result` has **no `$Global:UI` dependency** - this is
deliberate, since it's what lets tests run during the console pre-flight before any window
exists.

## Console pre-flight

Before `Show-VentanaPrincipal` is ever called, the `Main` region:

1. Handles self-elevation (UAC) and STA-mode relaunch if needed.
2. Calls `Import-ConfiguracionWifi` to load the real WiFi SSID/password from
   `wifi-config.txt`.
3. Calls `Get-InfoEquipo -MostrarProgreso`, which gathers Model/Serial/BIOS/CPU/RAM/Disk via
   WMI/CIM and prints a bordered, pure-ASCII step box for each field as it completes.
4. Runs `Test-WindowsUpdateService`, `Test-Wifi`, and `Test-WindowsActivation` directly
   (via `Invoke-PruebaMedida`), with the same ASCII step-box style, so their results are
   already in `$Global:Resultados` by the time the window opens.
5. Opens the main window.

Once the window is up, `Show-VentanaPrincipal` re-syncs the sidebar tiles and status bar
for those three pre-flight tests (`Update-FilaSidebarEstado`) so they show their real
PASS/FAIL/WARNING color immediately, instead of looking untested.

All console output in this codebase is deliberately **pure ASCII** - no box-drawing or
Unicode characters. A `.ps1` file without a UTF-8 BOM can be misread under the system's
ANSI codepage when launched with `-File` (which is exactly how the compiled launcher starts
it), which can silently corrupt the script's own tokenization. Sticking to ASCII removes
that failure mode entirely, regardless of how the script is launched.

## Equipment info panel: query live, don't cache

`Update-PanelInfoEquipo` queries WMI/CIM directly and inline **every single time it's
called** (window build, after the automatic tests finish, on language switch) rather than
reading from a value gathered once and cached. An earlier iteration of this panel tried
caching the WMI results in a `Get-InfoEquipo`-produced object and reusing it - Model
rendered fine, but Serial/BIOS/CPU/RAM/Disk consistently showed "Not available" even after
several retry attempts, for reasons that were never conclusively root-caused. Reverting to
direct, uncached queries fixed it immediately and has been stable since. `Get-InfoEquipo`
still exists, but only feeds the console pre-flight's progress display and the initial
report identifier - the actual panel never reads from it.

## Sidebar tile visual feedback

Two different functions color a sidebar tile, and which one applies depends on the test
type:

- **`Update-FilaSidebarEstado`** - used for automatic tests. Colors the tile by its actual
  aggregate result (PASS green, FAIL red, WARNING yellow, INFO blue) via
  `Get-EstadoMultiple`/`Get-ColorFondoFilaEstado`.
- **`Set-FilaSidebarCompletada`** - used for guided tests. The technician already saw and
  answered a Yes/No/N-A dialog for these, so the tile just needs a flat, consistent
  "done" color (not tied to the answer) - a solid blue background with a checkmark glyph.

Both call `Invoke-WpfDoEvents` (a nested `DispatcherFrame` pump) afterward to force an
immediate render, since WPF can otherwise leave a color change queued until the next
idle/dialog cycle.

## Reporting / export

`$Global:DatosExportacion` is an ordered hashtable holding the fields that go into the
Excel-style export row (Order, unit number, serial, disk size/serial, RAM x2, battery x2,
comment). `Get-IdentificadorReporte` returns the detected serial number (sanitized for use
in a filename) as the default identifier for the plain-text report and CSV export,
falling back to the computer name if no serial was detected.

`Preguntar-InfoOrden` asks, once per session (guarded by `$Global:OrdenPreguntada`), whether
the current job is tied to a work order - if yes, it asks for the order number; if no, it's
skipped entirely. It's wired into every realistic "I'm done" path: finishing Guided Tests,
manually exporting to Excel, and closing the window with an unexported result set.

## Responsive layout

`Show-VentanaPrincipal` clamps the window's width/height to
`[System.Windows.SystemParameters]::WorkArea` (the screen area excluding the taskbar) right
after building the XAML, and sets `WindowState = Maximized` as the default. The results
table's three GridView columns are resized proportionally on every `SizeChanged` event
(`Update-AnchoColumnasResultados`), so the layout adapts to any Toughbook's screen
resolution instead of using fixed pixel widths.
