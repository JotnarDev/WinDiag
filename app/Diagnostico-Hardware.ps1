<#
====================================================================================
 HARDWARE DIAGNOSTICS TOOL / HERRAMIENTA DE DIAGNOSTICO DE HARDWARE
====================================================================================
 Description : Native PowerShell application (WPF + WMI/CIM + .NET) for hardware
               diagnostics on corporate Windows computers. Single-window, tabbed,
               dark-themed UI (inspired by Chris Titus Tech's WinUtil). All
               interaction happens through the GUI; no console prompts (Read-Host)
               are used anywhere. Bilingual: English (default) and Spanish, with a
               language switch in the header.
 Compatible  : Windows 10 / Windows 11
 Requisitos  : PowerShell 5.1+ o PowerShell 7+ (sin modulos de terceros / no
               third-party modules)
 Version     : 3.0.0
====================================================================================
 USAGE:
   .\Diagnostico-Hardware.ps1
   The script self-elevates (UAC) and relaunches in STA mode automatically if
   needed.
====================================================================================
#>

$ErrorActionPreference = 'Continue'

#region Variables
$Global:Resultados = @()
$Global:TiemposEjecucion = @{}
$Global:RutaReportes = Join-Path -Path "$env:USERPROFILE\Desktop" -ChildPath "report"
$Global:VersionHerramienta = "3.0.0"
$Global:TiempoInicioEjecucion = $null
$Global:UI = $null
# Filled in by Get-InfoEquipo during the console pre-flight in Main, before the main window
# even exists - Update-PanelInfoEquipo then just renders this instead of re-querying WMI.
$Global:InfoEquipoCache = $null
$Global:ExportacionRealizada = $false
$Global:FiltroEstadoActual = "ALL"
$Global:PruebaEnCurso = $false
# Guards Preguntar-InfoOrden so the "is this a work order?" question is only ever asked once per
# session, no matter which finishing path (Guided Tests, manual Export Excel, or Close) gets there first.
$Global:OrdenPreguntada = $false

# ------------------------------------------------------------------------------------
# Single source of truth for every test the tool can run: display/translation key,
# the action to execute, and the result-category pattern(s) used to compute its
# PASS/FAIL/WARNING/INFO status. Used both by the "Run all" pipelines (Invoke-
# PruebasAutomaticas / Invoke-PruebasInteractivas) and by the individually
# clickable sidebar rows in the Diagnostics tab.
# ------------------------------------------------------------------------------------
$Global:CatalogoPruebasAutomaticas = [ordered]@{
    "Windows Update"     = @{ TxKey = "Side.WindowsUpdate";     Accion = { Test-WindowsUpdateService }; Patrones = @("Windows Update") }
    "WiFi"                = @{
        TxKey = "Side.WiFi"; Accion = { Test-Wifi }; Patrones = @("WiFi")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_NetworkAdapter -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -match 'Wireless|Wi-?Fi|802\.11' -and $_.PNPDeviceID -and $_.PhysicalAdapter -and $_.Name -notmatch 'Virtual|Hosted Network|Direct Virtual|Miniport'
        }) }
    }
    "Windows Activation"  = @{ TxKey = "Side.WindowsActivation"; Accion = { Test-WindowsActivation };     Patrones = @("Windows Activation") }
    "Drivers"             = @{ TxKey = "Side.Drivers";           Accion = { Test-Drivers };               Patrones = @("Drivers") }
    "Driver Versions"     = @{ TxKey = "Side.DriverVersions";    Accion = { Test-VersionesDrivers };      Patrones = @("Driver Versions") }
    "Battery"             = @{
        TxKey = "Side.Battery"; Accion = { Test-Battery }; Patrones = @("Battery")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue) }
    }
    "Bluetooth"           = @{
        TxKey = "Side.Bluetooth"; Accion = { Test-Bluetooth }; Patrones = @("Bluetooth")
        Detectar = { [bool](Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue) }
    }
    "WWAN"                = @{
        TxKey = "Side.WWAN"; Accion = { Test-WWAN }; Patrones = @("WWAN")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'WWAN|Cellular|Mobile Broadband' }) }
    }
    "Optical Drive"       = @{
        TxKey = "Side.OpticalDrive"; Accion = { Test-OpticalDrive }; Patrones = @("Optical Drive")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_CDROMDrive -ErrorAction SilentlyContinue) }
    }
    "BIOS"                = @{ TxKey = "Side.BIOS";              Accion = { Test-BIOS };                  Patrones = @("BIOS", "Computer") }
    # "Uptime" is hidden for now - re-enable by uncommenting this line.
    # "Uptime"              = @{ TxKey = "Side.Uptime";            Accion = { Test-Uptime };                Patrones = @("Uptime") }
    "CPU"                 = @{ TxKey = "Side.CPU";               Accion = { Test-CPU };                   Patrones = @("CPU") }
    "RAM"                 = @{ TxKey = "Side.RAM";               Accion = { Test-RAM };                   Patrones = @("RAM") }
    "Disk"                = @{ TxKey = "Side.Disk";              Accion = { Test-Disco };                 Patrones = @("Disk") }
    # "GPU" and "Display" are hidden for now - re-enable by uncommenting these two lines.
    # "GPU"                 = @{ TxKey = "Side.GPU";               Accion = { Test-GPU };                   Patrones = @("GPU") }
    # "Display"             = @{ TxKey = "Side.Display";           Accion = { Test-Pantalla };               Patrones = @("Display") }
}
$Global:CatalogoPruebasGuiadas = [ordered]@{
    "USB"               = @{
        TxKey = "Side.USB"; Accion = { Test-USB-Interactivo }; Patrones = @("USB")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_USBController -ErrorAction SilentlyContinue) }
    }
    "DVD"               = @{
        TxKey = "Side.DVD"; Accion = { Test-DVD-Interactivo }; Patrones = @("DVD")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_CDROMDrive -ErrorAction SilentlyContinue) }
    }
    "Camera"            = @{
        TxKey = "Side.Camera"; Accion = { Test-Camara-Interactivo }; Patrones = @("Camera")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.PNPClass -eq 'Camera' -or $_.PNPClass -eq 'Image' -or $_.Name -match 'Camera|Webcam' }) }
    }
    "Audio"             = @{
        TxKey = "Side.Audio"; Accion = { Test-Audio-Interactivo }; Patrones = @("Audio")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_SoundDevice -ErrorAction SilentlyContinue) }
    }
    "Microphone"        = @{
        TxKey = "Side.Microphone"; Accion = { Test-Microfono-Interactivo }; Patrones = @("Microphone")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_SoundDevice -ErrorAction SilentlyContinue) }
    }
    "Keyboard"          = @{
        TxKey = "Side.Keyboard"; Accion = { Test-Teclado-Interactivo }; Patrones = @("Keyboard")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_Keyboard -ErrorAction SilentlyContinue) }
    }
    "Touchpad"          = @{
        TxKey = "Side.Touchpad"; Accion = { Test-Touchpad-Interactivo }; Patrones = @("Touchpad")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Touchpad|Touch Pad|Synaptics|ELAN|ALPS|Precision Touchpad' }) }
    }
    "Touch Screen"      = @{
        TxKey = "Side.TouchScreen"; Accion = { Test-PantallaTactil-Interactivo }; Patrones = @("Touch Screen")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Touch ?Screen|HID-compliant touch' }) }
    }
    "Biometric Reader"  = @{
        TxKey = "Side.BiometricReader"; Accion = { Test-Biometrico-Interactivo }; Patrones = @("Biometric Reader")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Fingerprint|Biometric' }) }
    }
    "SmartCard Reader"  = @{
        TxKey = "Side.SmartCardReader"; Accion = { Test-SmartCard-Interactivo }; Patrones = @("SmartCard Reader")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.PNPClass -eq 'SmartCardReader' -or $_.Name -match 'Smart ?Card' }) }
    }
    "Barcode Reader"    = @{
        TxKey = "Side.BarcodeReader"; Accion = { Test-CodigoBarras-Interactivo }; Patrones = @("Barcode Reader")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Barcode|Scanner' }) }
    }
    "GPS"               = @{
        TxKey = "Side.GPS"; Accion = { Test-GPS-Interactivo }; Patrones = @("GPS")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'GPS|GNSS' -or $_.PNPClass -eq 'SensorsAndLocation' }) }
    }
    "Stylus"            = @{
        TxKey = "Side.Stylus"; Accion = { Test-Stylus-Interactivo }; Patrones = @("Stylus")
        Detectar = { [bool](Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Pen|Stylus|Digitizer' }) }
    }
    # "Screen Test" moved out of the guided-tests grid - it now lives as its own button in the
    # Equipment Info panel (next to TabCal/Sysprep), see btnScreenTest in Show-VentanaPrincipal.
    "Ports"             = @{ TxKey = "Side.Ports";            Accion = { Test-Puertos-Interactivo };         Patrones = @("Port*") }
}

# Idioma activo: "EN" (predeterminado) o "ES". Se puede cambiar en tiempo de
# ejecucion desde los botones EN/ES del encabezado de la ventana.
$Global:Idioma = "EN"

# ------------------------------------------------------------------------------------
# WiFi auto-connect configuration (Phase 1, step 2). These start empty on purpose -
# the real SSID/password live only in wifi-config.txt (same folder as this script,
# read by Import-ConfiguracionWifi during the Main pre-flight), never in this source
# file. If $Global:WifiUsarPerfilGuardado is $true, the script will try to connect
# using a WiFi profile already saved in Windows with this SSID (no password needed).
# If $false, $Global:WifiPassword is used to build the connection profile.
# ------------------------------------------------------------------------------------
$Global:WifiSSID = $null
$Global:WifiPassword = $null
$Global:WifiUsarPerfilGuardado = $true

# ------------------------------------------------------------------------------------
# List of specific drivers to validate (minimum required version). Filled in later.
# Each item: @{ Nombre = "text to search in the driver name"; VersionMinima = "x.x.x.x" }
# While empty, the test only reports that nothing is configured.
# ------------------------------------------------------------------------------------
$Global:DriversEsperados = @(
    # Example (uncomment and adjust once the final list is known):
    # @{ Nombre = "Intel(R) Wi-Fi"; VersionMinima = "22.0.0.1" }
)

# ------------------------------------------------------------------------------------
# Structured data for the final plain-text export (Excel-ready row). Filled in
# during the automatic tests and from the technician's entries in "Settings".
# ------------------------------------------------------------------------------------
$Global:DatosExportacion = [ordered]@{
    Order       = ""
    NumberUnit  = ""
    SerialModel = ""
    SizeDisk    = ""
    SerialDisk  = ""
    RAM1        = ""
    RAM2        = ""
    Battery1    = ""
    Battery2    = ""
    Comentario  = ""
}

$Global:RutaExportacionExcel = Join-Path -Path $Global:RutaReportes -ChildPath "Export-Excel.txt"

# ------------------------------------------------------------------------------------
# Bilingual text table. Every user-facing string (GUI chrome, dialog questions,
# result detail messages) is looked up here through the Tx() helper (see Funciones
# region), keyed by a stable, language-independent key. Component category names
# (the "Componente" field of each result) are intentionally kept in English in both
# languages, since they double as internal matching keys for the Excel export.
# ------------------------------------------------------------------------------------
$Global:Textos = @{
    "EN" = @{
        "App.Title"        = "Hardware Diagnostics"
        "Tab.Config"        = "SETTINGS"
        "Tab.Diag"          = "DIAGNOSTICS & REPORT"
        "Config.Order"      = "Order / ticket number"
        "Config.Unit"       = "Unit number"
        "Config.SSID"       = "WiFi network (SSID)"
        "Config.Password"   = "WiFi password"
        "Config.SavedProfile" = "Use a WiFi profile already saved in Windows"
        "Config.Start"      = "Start Automatic Diagnostics"
        "Config.Help"       = "Jotnar"
        "Diag.Waiting"      = "Press Start Automatic Diagnostics to begin."
        "Diag.Guided"       = "Guided Tests"
        "Diag.Save"         = "Save Report"
        "Diag.CSV"          = "Export CSV"
        "Diag.Excel"        = "Export Excel"
        "Diag.Restart"      = "Finish & Restart"
        "Diag.Close"        = "Close"
        "Col.Component"     = "Component"
        "Col.Status"        = "Status"
        "Col.Detail"        = "Detail"
        "Dash.Total"        = "TOTAL TESTS"
        "Dash.Pass"         = "PASSED"
        "Dash.Fail"         = "FAILED"
        "Dash.Warning"      = "WARNINGS"
        "Filter.All"        = "All"
        "Filter.Pass"       = "Passed"
        "Filter.Fail"       = "Failed"
        "Filter.Warning"    = "Warnings"
        "Filter.Info"       = "Info"
        "Config.SectionTitle" = "General Information"
        "Status.Computer"   = "Computer"
        "Status.User"       = "User"
        "Status.OS"         = "Windows"
        "Status.Date"       = "Date"
        "Status.Tests"      = "Tests"
        "Lang.Label"        = "Language"

        "Progress.Running"        = "({0}/{1}) Running: {2}"
        "Progress.RunningOne"     = "Running: {0}..."
        "Progress.Phase1Done"     = "Automatic tests completed."
        "Progress.Phase1Summary"  = "Phase 1 completed in {0}s. You can run Guided Tests or export the report."
        "Progress.GuidedRunning"  = "Guided test: {0}"
        "Progress.Phase2Done"     = "Guided tests completed. Row added to the export."

        "Sidebar.AutoTitle"   = "AUTOMATIC TESTS"
        "Sidebar.GuidedTitle" = "GUIDED TESTS"
        "Info.PanelTitle" = "EQUIPMENT INFO"
        "Info.Model"      = "Model"
        "Info.Serial"     = "Serial"
        "Info.BIOS"       = "BIOS"
        "Info.CPU"        = "CPU"
        "Info.RAM"        = "RAM"
        "Info.Disk"       = "Disk"
        "Info.CalibrateTouch" = "Calibrate Touch Screen"
        "Info.Sysprep"        = "Sysprep"
        "Info.Modules"      = "modules"
        "Info.Module"       = "Module"
        "Info.NotAvailable" = "Not available"
        "Side.WindowsUpdate"     = "Windows Update"
        "Side.WiFi"              = "WiFi"
        "Side.WindowsActivation" = "Windows Activation"
        "Side.Drivers"           = "Drivers"
        "Side.DriverVersions"    = "Driver Versions"
        "Side.Battery"           = "Battery"
        "Side.Bluetooth"         = "Bluetooth"
        "Side.WWAN"              = "WWAN"
        "Side.OpticalDrive"      = "Optical Drive"
        "Side.BIOS"              = "BIOS"
        "Side.Uptime"            = "Uptime"
        "Side.CPU"               = "CPU"
        "Side.RAM"               = "RAM"
        "Side.Disk"              = "Disk"
        "Side.GPU"               = "GPU"
        "Side.Display"           = "Display"
        "Side.USB"               = "USB"
        "Side.DVD"               = "DVD"
        "Side.Camera"            = "Camera"
        "Side.Audio"             = "Audio"
        "Side.Microphone"        = "Microphone"
        "Side.Keyboard"          = "Keyboard"
        "Side.Touchpad"          = "Touchpad"
        "Side.TouchScreen"       = "Touch Screen"
        "Side.BiometricReader"   = "Biometric Reader"
        "Side.SmartCardReader"   = "SmartCard Reader"
        "Side.BarcodeReader"     = "Barcode Reader"
        "Side.GPS"               = "GPS"
        "Side.Stylus"            = "Stylus"
        "Side.ScreenTest"        = "Screen Test"
        "Side.Ports"             = "Ports"

        "Dialog.Title"        = "Hardware Diagnostics"
        "Dialog.ErrorTitle"   = "Error"
        "Dialog.Comment"      = "Additional comment for the export (optional)"
        "Ask.IsOrder"         = "Is this service tied to a work order?"
        "Ask.IsOrderTitle"    = "Work Order"
        "Ask.OrderNumber"     = "Enter the order/ticket number:"
        "Dialog.RestartConfirm" = "Do you want to restart the computer now?"
        "Dialog.RestartTitle" = "Confirm Restart"
        "Dialog.ExportBeforeClose"      = "The Excel row hasn't been exported yet. Export before closing?"
        "Dialog.ExportBeforeCloseTitle" = "Export before exit"
        "Dialog.StartError"   = "Error starting diagnostics: {0}"
        "Dialog.GuidedError"  = "Error in guided tests: {0}"
        "Dialog.RestartError" = "Error trying to restart the computer: {0}"
        "Dialog.TabCalError"  = "Could not launch the touch screen calibration tool (tabcal.exe): {0}"
        "Dialog.SysprepConfirm" = "This will launch Sysprep, which resets the Windows installation for imaging. It may shut down or restart the computer, and cannot be undone. Continue?"
        "Dialog.SysprepTitle"   = "Confirm Sysprep"
        "Dialog.SysprepNotFound" = "Sysprep was not found at the expected location (System32\Sysprep\sysprep.exe)."
        "Dialog.SysprepError"   = "Could not launch Sysprep: {0}"
        "Dialog.CriticalUI"   = "Critical error showing the interface: {0}"
        "Dialog.ReportSaved"  = "Report saved successfully at:`n{0}"
        "Dialog.ReportSavedTitle" = "Report Saved"
        "Dialog.ReportError"  = "Error saving the report: {0}"
        "Dialog.CSVSaved"     = "CSV file exported successfully at:`n{0}"
        "Dialog.CSVSavedTitle" = "Export Complete"
        "Dialog.CSVError"     = "Error exporting the CSV: {0}"
        "Dialog.ExcelSaved"   = "Row added successfully to:`n{0}"
        "Dialog.ExcelSavedTitle" = "Excel Export"
        "Dialog.ExcelError"   = "Error exporting the row: {0}"
        "Dialog.Accept"       = "Accept"
        "Dialog.Continue"     = "Continue"
        "Dialog.Yes"          = "Yes"
        "Dialog.No"           = "No"
        "Dialog.NA"           = "N/A"
        "Dialog.Pass"         = "PASS"
        "Dialog.Fail"         = "FAIL"
        "Dialog.NumbersOnly"  = "{0} (numbers only)"

        "Ask.USBWait"    = "{0} USB controller(s) detected. Plug a USB drive into every physical port and press Continue when done."
        "Ask.USBTotal"   = "How many ports did you test in total?"
        "Ask.USBWorking" = "How many ports worked correctly?"
        "Ask.DVDWait"    = "Insert a disc (CD/DVD), wait for the tray to close and for Windows to recognize it. Press Continue when ready."
        "Ask.DVDRead"    = "Did the drive recognize the disc and read it correctly (e.g. did it open in File Explorer)?"
        "Ask.Camera"     = "Does the camera image display correctly?"
        "Ask.Audio"      = "Did you hear the test tone, first on the left speaker and then on the right?"
        "Ask.Mic"        = "Speak into the microphone and watch the input level indicator. Did it detect activity?"
        "Ask.KeyboardTool"       = "Did the keyboard work correctly in the manufacturer's tool?"
        "Ask.KeyboardManualWait" = "KeyTest was not found. Press several keys (letters, numbers, function) and then press Continue."
        "Ask.KeyboardManual"     = "Did all the keys you tested respond correctly?"
        "Ask.Touchpad"    = "Does the touchpad work correctly (movement and clicks)?"
        "Ask.TouchScreen" = "Touch hardware was detected. Does it respond correctly to touch?"
        "Ask.Biometric"   = "A biometric reader was detected. Does it work correctly?"
        "Ask.SmartCard"   = "Does the SmartCard reader work correctly?"
        "Ask.Barcode"     = "Does the barcode reader work correctly?"
        "Ask.GPS"         = "Does the GPS work correctly?"
        "Ask.StylusWait"  = "Switch to the desktop or an app (e.g. Paint) and try drawing with the stylus/digital pen. Press Continue when done."
        "Ask.Stylus"      = "Does the stylus/digital pen work correctly?"
        "Ask.ScreenTest"  = "Did the screen display all colors correctly, with no dead pixels, discoloration, or backlight issues?"
        "ScreenTest.Help" = "Left / Right or Space to change color   |   Esc to exit"
        "ScreenTest.Prev" = "Prev"
        "ScreenTest.Next" = "Next"
        "ScreenTest.Close" = "Close"
        "Color.White"     = "White"
        "Color.Black"     = "Black"
        "Color.Red"       = "Red"
        "Color.Green"     = "Green"
        "Color.Blue"      = "Blue"
        "Color.Gray50"    = "50% Gray"
        "Ask.Port"        = "Does the {0} port work correctly?"

        "Port.AudioJack" = "Audio Jack"

        "BatStatus.1" = "Discharging"
        "BatStatus.2" = "On AC power (no battery)"
        "BatStatus.3" = "Fully charged"
        "BatStatus.4" = "Low"
        "BatStatus.5" = "Critical"
        "BatStatus.6" = "Charging"
        "BatStatus.7" = "Charging, high level"
        "BatStatus.8" = "Charging, low level"
        "BatStatus.9" = "Charging, critical level"
        "BatStatus.10" = "Unknown"
        "BatStatus.11" = "Idle"
        "BatStatus.Default" = "Not available"

        "Det.WU.Ok"   = "wuauserv service stopped and disabled successfully."
        "Det.WU.Fail" = "Could not stop/disable wuauserv: {0}"
        "Det.Activation.Ok"        = "Windows is activated. ({0})"
        "Det.Activation.NotActive" = "Windows is NOT activated."
        "Det.Activation.Warn"      = "Could not query activation status: {0}"
        "Det.Drivers.Fail" = "Devices with driver errors: {0}"
        "Det.Drivers.Ok"   = "No devices with driver errors were found."
        "Det.Drivers.Warn" = "Error querying PnP devices: {0}"
        "Det.DriverVer.NoList"      = "No driver list configured yet (pending definition)."
        "Det.DriverVer.NotFound"    = "No installed driver matching '{0}' was found."
        "Det.DriverVer.Ok"          = "{0}: version {1} (minimum required: {2})."
        "Det.DriverVer.TooLow"      = "{0}: version {1} is lower than the minimum required ({2})."
        "Det.DriverVer.CompareWarn" = "Could not compare the version of '{0}': {1}"
        "Det.DriverVer.Warn"        = "Error validating driver versions: {0}"
        "Det.Battery.NotFound"  = "Desktop computer or battery not detected."
        "Det.Battery.WithHealth" = "Battery {0} - Charge: {1}% | Status: {2} | Health: {3}%"
        "Det.Battery.NoHealth"  = "Battery {0} - Charge: {1}% | Status: {2} | Health: not available"
        "Det.Battery.Warn"      = "Could not query the battery: {0}"
        "Det.Wifi.NotFound"   = "No WiFi adapter detected."
        "Det.Wifi.Connecting" = "Attempting to connect automatically to '{0}'..."
        "Det.Wifi.Info"       = "Adapter: {0} | Enabled: {1} | Connected: {2} | SSID: {3}"
        "Det.Wifi.Warn"       = "Error querying WiFi adapters: {0}"
        "Det.BT.NotFound"      = "No Bluetooth hardware detected."
        "Det.BT.CouldNotEnable"= "Bluetooth detected but could not be enabled."
        "Det.BT.NearbyFound"   = "Bluetooth enabled. Nearby/paired devices: {0}"
        "Det.BT.NoNearby"      = "Bluetooth enabled. No nearby/paired devices detected."
        "Det.BT.Warn"          = "Error querying/enabling Bluetooth: {0}"
        "Wifi.Popup.NoData"  = "No WiFi networks could be listed (adapter disabled or scan not supported)."
        "Wifi.Popup.Error"   = "Error listing WiFi networks: {0}"
        "BT.Popup.NoData"    = "No Bluetooth devices were found."
        "BT.Popup.Error"     = "Error listing Bluetooth devices: {0}"
        "Det.WWAN.Found"    = "Cellular adapter detected: {0}"
        "Det.WWAN.NotFound" = "No WWAN/cellular adapter detected."
        "Det.WWAN.Warn"     = "Error querying WWAN adapters: {0}"
        "Det.Optical.Found"     = "Drive detected: {0}"
        "Det.Optical.Ejected"   = "Tray ejected on drive {0}"
        "Det.Optical.EjectWarn" = "Could not eject the tray of {0}: {1}"
        "Det.Optical.NotFound"  = "No physical optical drive detected."
        "Det.Optical.Warn"      = "Error querying optical drive: {0}"
        "Det.DVD.Skipped" = "No physical optical drive detected; interactive test skipped."
        "Det.DVD.Detail"  = "Disc reading check performed by the user."
        "Det.DVD.Warn"    = "Error testing the optical drive: {0}"
        "Det.BIOS.Info" = "Version: {0}"
        "Det.BIOS.Warn" = "Error querying BIOS information: {0}"
        "Det.Computer.Info" = "Model: {0} | Serial: {1}"
        "Det.Uptime.Info" = "Uptime: {0} hours"
        "Det.Uptime.Warn" = "Error calculating uptime: {0}"
        "Det.CPU.Info" = "{0} | Cores: {1} | Threads: {2}"
        "Det.CPU.Warn" = "Error querying the processor: {0}"
        "Det.RAM.Info"         = "Installed capacity: {0} GB | Modules: {1} | Speed: {2} MHz"
        "Det.RAM.Module"       = "Module {0}: {1} | Model: {2} | Serial: {3} | {4} MHz | {5} GB"
        "Det.RAM.MoreThanTwo"  = "This computer has more than 2 modules ({0}); only the first two are listed in the export."
        "Det.RAM.NotFound"     = "Could not obtain physical memory information."
        "Det.RAM.Warn"         = "Error querying RAM: {0}"
        "Det.Disk.Info"        = "{0} | Model: {1} | Serial: {2} | {3} GB"
        "Det.Disk.MoreThanOne" = "This computer has more than one physical disk ({0}); only the first one is used in the export."
        "Det.Disk.LogicalInfo" = "Drive {0} - Free space: {1} GB of {2} GB"
        "Det.Disk.Warn"        = "Error querying disks: {0}"
        "Det.SMART.Info"      = "Device: {0} | Failure predicted: {1}"
        "Det.SMART.NotFound"  = "No SMART entries available were found."
        "Det.SMART.Warn"      = "Could not get SMART status (may require additional permissions or not be supported): {0}"
        "Det.GPU.Info" = "Model: {0} | VRAM: {1} GB | Driver: {2}"
        "Det.GPU.Warn" = "Error querying the GPU: {0}"
        "Det.Display.Info" = "Current resolution: {0}x{1} | Number of monitors: {2}"
        "Det.Display.Warn" = "Error querying the display: {0}"
        "Det.USB.NoPorts"   = "No tested ports were specified."
        "Det.USB.Result"    = "{0} of {1} ports worked ({2}%). USB controllers detected: {3}."
        "Det.USB.NotFound"  = "No USB controller detected on this computer; test skipped."
        "Det.USB.Warn"      = "Error testing the USB ports: {0}"
        "Det.Camera.Result"   = "Visual check performed by the user in the Camera app."
        "Det.Camera.NotFound" = "No camera detected on this computer; test skipped."
        "Det.Camera.Warn"     = "Could not open the camera application: {0}"
        "Det.Audio.Result"   = "Speaker test (generated tone: left then right channel)."
        "Det.Audio.NotFound" = "No audio device detected on this computer; test skipped."
        "Det.Audio.Warn"     = "Error playing the test sound: {0}"
        "Det.Mic.Result"   = "Check performed via Windows Sound Settings."
        "Det.Mic.NotFound" = "No audio device detected on this computer; microphone test skipped."
        "Det.Mic.Warn"     = "Could not open sound settings: {0}"
        "Det.Keyboard.Tool"     = "Test performed with dedicated tool: {0}"
        "Det.Keyboard.Manual"   = "Manual test requested from the user (KeyTest not found)."
        "Det.Keyboard.NotFound" = "No keyboard detected on this computer; test skipped."
        "Det.Keyboard.Warn"     = "Error testing the keyboard: {0}"
        "Det.Touchpad.Result"   = "Manual check performed by the user."
        "Det.Touchpad.NotFound" = "No touchpad detected on this computer; test skipped."
        "Det.Touchpad.Warn"     = "Error testing the touchpad: {0}"
        "Det.TouchScreen.HW"   = "Hardware detected: {0}"
        "Det.TouchScreen.NA"   = "Not available."
        "Det.TouchScreen.Warn" = "Error checking touch screen: {0}"
        "Det.Biometric.HW"       = "Hardware detected: {0}"
        "Det.Biometric.NotFound" = "No biometric reader detected."
        "Det.Biometric.Warn"     = "Error checking biometric reader: {0}"
        "Det.SmartCard.Result"   = "Manual check performed by the user."
        "Det.SmartCard.NotFound" = "No SmartCard reader detected on this computer; test skipped."
        "Det.SmartCard.Warn"     = "Error testing the SmartCard reader: {0}"
        "Det.Barcode.Result"   = "Manual check performed by the user."
        "Det.Barcode.NotFound" = "No barcode reader detected on this computer; test skipped."
        "Det.Barcode.Warn"     = "Error testing the barcode reader: {0}"
        "Det.GPS.Result"   = "Manual check performed by the user."
        "Det.GPS.NotFound" = "No GPS detected on this computer; test skipped."
        "Det.GPS.Warn"     = "Error testing the GPS: {0}"
        "Det.Stylus.Result"   = "Manual check performed by the user."
        "Det.Stylus.NotFound" = "No stylus/digitizer detected on this computer; test skipped."
        "Det.Stylus.Warn"     = "Error testing the stylus: {0}"
        "Det.ScreenTest.Result" = "Visual check performed by the user (white/black/red/green/blue/50% gray)."
        "Det.ScreenTest.Warn"   = "Error running the screen test: {0}"
        "Det.Port.Result"   = "Manual check performed by the user."
        "Det.Port.NotFound" = "{0}: not detected on this computer; test skipped."
        "Det.Ports.Warn"    = "Error testing the ports: {0}"
    }
    "ES" = @{
        "App.Title"        = "Diagnostico de Hardware"
        "Tab.Config"        = "CONFIGURACION"
        "Tab.Diag"          = "DIAGNOSTICO Y REPORTE"
        "Config.Order"      = "Numero de orden / ticket (Order)"
        "Config.Unit"       = "Numero de unidad (Number Unit)"
        "Config.SSID"       = "Red WiFi (SSID)"
        "Config.Password"   = "Contrasena WiFi"
        "Config.SavedProfile" = "Usar perfil de WiFi ya guardado en Windows"
        "Config.Start"      = "Iniciar Diagnostico Automatico"
        "Config.Help"       = "Jotnar"
        "Diag.Waiting"      = "Presione Iniciar Diagnostico Automatico para comenzar."
        "Diag.Guided"       = "Pruebas Guiadas"
        "Diag.Save"         = "Guardar Reporte"
        "Diag.CSV"          = "Exportar CSV"
        "Diag.Excel"        = "Exportar Excel"
        "Diag.Restart"      = "Finalizar y Reiniciar"
        "Diag.Close"        = "Cerrar"
        "Col.Component"     = "Componente"
        "Col.Status"        = "Estado"
        "Col.Detail"        = "Detalle"
        "Dash.Total"        = "PRUEBAS TOTALES"
        "Dash.Pass"         = "APROBADAS"
        "Dash.Fail"         = "FALLIDAS"
        "Dash.Warning"      = "ADVERTENCIAS"
        "Filter.All"        = "Todas"
        "Filter.Pass"       = "Aprobadas"
        "Filter.Fail"       = "Fallidas"
        "Filter.Warning"    = "Advertencias"
        "Filter.Info"       = "Info"
        "Config.SectionTitle" = "Informacion General"
        "Status.Computer"   = "Equipo"
        "Status.User"       = "Usuario"
        "Status.OS"         = "Windows"
        "Status.Date"       = "Fecha"
        "Status.Tests"      = "Pruebas"
        "Lang.Label"        = "Idioma"

        "Progress.Running"        = "({0}/{1}) Ejecutando: {2}"
        "Progress.RunningOne"     = "Ejecutando: {0}..."
        "Progress.Phase1Done"     = "Pruebas automaticas completadas."
        "Progress.Phase1Summary"  = "Fase 1 completada en {0} s. Puede ejecutar las Pruebas Guiadas o exportar el reporte."
        "Progress.GuidedRunning"  = "Prueba guiada: {0}"
        "Progress.Phase2Done"     = "Pruebas guiadas completadas. Fila agregada a la exportacion."

        "Sidebar.AutoTitle"   = "PRUEBAS AUTOMATICAS"
        "Sidebar.GuidedTitle" = "PRUEBAS GUIADAS"
        "Info.PanelTitle" = "INFO DEL EQUIPO"
        "Info.Model"      = "Modelo"
        "Info.Serial"     = "Serial"
        "Info.BIOS"       = "BIOS"
        "Info.CPU"        = "CPU"
        "Info.RAM"        = "RAM"
        "Info.Disk"       = "Disco"
        "Info.CalibrateTouch" = "Calibrar Pantalla Tactil"
        "Info.Sysprep"        = "Sysprep"
        "Info.Modules"      = "modulos"
        "Info.Module"       = "Modulo"
        "Info.NotAvailable" = "No disponible"
        "Side.WindowsUpdate"     = "Windows Update"
        "Side.WiFi"              = "WiFi"
        "Side.WindowsActivation" = "Activacion de Windows"
        "Side.Drivers"           = "Drivers"
        "Side.DriverVersions"    = "Versiones de Drivers"
        "Side.Battery"           = "Bateria"
        "Side.Bluetooth"         = "Bluetooth"
        "Side.WWAN"              = "WWAN"
        "Side.OpticalDrive"      = "Unidad Optica"
        "Side.BIOS"              = "BIOS"
        "Side.Uptime"            = "Tiempo Activo"
        "Side.CPU"               = "CPU"
        "Side.RAM"               = "RAM"
        "Side.Disk"              = "Disco"
        "Side.GPU"               = "GPU"
        "Side.Display"           = "Pantalla"
        "Side.USB"               = "USB"
        "Side.DVD"               = "DVD"
        "Side.Camera"            = "Camara"
        "Side.Audio"             = "Audio"
        "Side.Microphone"        = "Microfono"
        "Side.Keyboard"          = "Teclado"
        "Side.Touchpad"          = "Touchpad"
        "Side.TouchScreen"       = "Pantalla Tactil"
        "Side.BiometricReader"   = "Lector Biometrico"
        "Side.SmartCardReader"   = "Lector SmartCard"
        "Side.BarcodeReader"     = "Lector de Codigo de Barras"
        "Side.GPS"               = "GPS"
        "Side.Stylus"            = "Lapiz Digital"
        "Side.ScreenTest"        = "Prueba de Pantalla"
        "Side.Ports"             = "Puertos"

        "Dialog.Title"        = "Diagnostico de Hardware"
        "Dialog.ErrorTitle"   = "Error"
        "Dialog.Comment"      = "Comentario adicional para la exportacion (opcional)"
        "Ask.IsOrder"         = "¿Este servicio corresponde a una orden de trabajo?"
        "Ask.IsOrderTitle"    = "Orden de Trabajo"
        "Ask.OrderNumber"     = "Ingrese el numero de orden/ticket:"
        "Dialog.RestartConfirm" = "¿Desea reiniciar el equipo ahora?"
        "Dialog.RestartTitle" = "Confirmar Reinicio"
        "Dialog.ExportBeforeClose"      = "Aun no se exporto la fila a Excel. ¿Exportar antes de cerrar?"
        "Dialog.ExportBeforeCloseTitle" = "Exportar antes de salir"
        "Dialog.StartError"   = "Error al iniciar el diagnostico: {0}"
        "Dialog.GuidedError"  = "Error en las pruebas guiadas: {0}"
        "Dialog.RestartError" = "Error al intentar reiniciar el equipo: {0}"
        "Dialog.TabCalError"  = "No se pudo abrir la herramienta de calibracion de pantalla tactil (tabcal.exe): {0}"
        "Dialog.SysprepConfirm" = "Esto abrira Sysprep, que reinicia la configuracion de Windows para generar una imagen. Puede apagar o reiniciar el equipo y no se puede deshacer. ¿Desea continuar?"
        "Dialog.SysprepTitle"   = "Confirmar Sysprep"
        "Dialog.SysprepNotFound" = "No se encontro Sysprep en la ubicacion esperada (System32\Sysprep\sysprep.exe)."
        "Dialog.SysprepError"   = "No se pudo abrir Sysprep: {0}"
        "Dialog.CriticalUI"   = "Error critico al mostrar la interfaz: {0}"
        "Dialog.ReportSaved"  = "Reporte guardado correctamente en:`n{0}"
        "Dialog.ReportSavedTitle" = "Reporte Guardado"
        "Dialog.ReportError"  = "Error al guardar el reporte: {0}"
        "Dialog.CSVSaved"     = "Archivo CSV exportado correctamente en:`n{0}"
        "Dialog.CSVSavedTitle" = "Exportacion Completa"
        "Dialog.CSVError"     = "Error al exportar el CSV: {0}"
        "Dialog.ExcelSaved"   = "Fila agregada correctamente a:`n{0}"
        "Dialog.ExcelSavedTitle" = "Exportacion a Excel"
        "Dialog.ExcelError"   = "Error al exportar la fila: {0}"
        "Dialog.Accept"       = "Aceptar"
        "Dialog.Continue"     = "Continuar"
        "Dialog.Yes"          = "Si"
        "Dialog.No"           = "No"
        "Dialog.NA"           = "No aplica"
        "Dialog.Pass"         = "PASS"
        "Dialog.Fail"         = "FAIL"
        "Dialog.NumbersOnly"  = "{0} (solo numeros)"

        "Ask.USBWait"    = "Se detectaron {0} controlador(es) USB. Conecte una memoria USB en cada puerto fisico y presione Continuar cuando termine."
        "Ask.USBTotal"   = "¿Cuantos puertos probo en total?"
        "Ask.USBWorking" = "¿Cuantos puertos funcionaron correctamente?"
        "Ask.DVDWait"    = "Inserte un disco (CD/DVD), espere a que la bandeja cierre y a que Windows lo reconozca. Presione Continuar cuando este listo."
        "Ask.DVDRead"    = "¿La unidad reconocio el disco y pudo leerlo correctamente (por ejemplo, aparecio en el Explorador de archivos)?"
        "Ask.Camera"     = "¿La imagen de la camara se visualiza correctamente?"
        "Ask.Audio"      = "¿Escucho el tono de prueba, primero por el altavoz izquierdo y luego por el derecho?"
        "Ask.Mic"        = "Hable frente al microfono y observe el indicador de nivel de entrada. ¿Detecto actividad?"
        "Ask.KeyboardTool"       = "¿El teclado funciono correctamente en la herramienta del fabricante?"
        "Ask.KeyboardManualWait" = "No se encontro KeyTest. Presione varias teclas (letras, numeros, funcion) y luego presione Continuar."
        "Ask.KeyboardManual"     = "¿Todas las teclas probadas respondieron correctamente?"
        "Ask.Touchpad"    = "¿El touchpad funciona correctamente (movimiento y clics)?"
        "Ask.TouchScreen" = "Se detecto hardware de pantalla tactil. ¿Responde correctamente al tacto?"
        "Ask.Biometric"   = "Se detecto lector biometrico. ¿Funciona correctamente?"
        "Ask.SmartCard"   = "¿El lector de SmartCard funciona correctamente?"
        "Ask.Barcode"     = "¿El lector de codigo de barras funciona correctamente?"
        "Ask.GPS"         = "¿El GPS funciona correctamente?"
        "Ask.StylusWait"  = "Cambie al escritorio o a una app (por ejemplo Paint) e intente dibujar con el stylus/lapiz digital. Presione Continuar cuando termine."
        "Ask.Stylus"      = "¿El stylus/lapiz digital funciona correctamente?"
        "Ask.ScreenTest"  = "¿La pantalla mostro todos los colores correctamente, sin pixeles muertos, decoloracion o problemas de retroiluminacion?"
        "ScreenTest.Help" = "Izquierda / Derecha o Espacio para cambiar de color   |   Esc para salir"
        "ScreenTest.Prev" = "Anterior"
        "ScreenTest.Next" = "Siguiente"
        "ScreenTest.Close" = "Cerrar"
        "Color.White"     = "Blanco"
        "Color.Black"     = "Negro"
        "Color.Red"       = "Rojo"
        "Color.Green"     = "Verde"
        "Color.Blue"      = "Azul"
        "Color.Gray50"    = "Gris 50%"
        "Ask.Port"        = "¿El puerto {0} funciona correctamente?"

        "Port.AudioJack" = "Jack de Audio"

        "BatStatus.1" = "Descargando"
        "BatStatus.2" = "Con adaptador de corriente (sin bateria)"
        "BatStatus.3" = "Totalmente cargada"
        "BatStatus.4" = "Baja"
        "BatStatus.5" = "Critica"
        "BatStatus.6" = "Cargando"
        "BatStatus.7" = "Cargando y con nivel alto"
        "BatStatus.8" = "Cargando y con nivel bajo"
        "BatStatus.9" = "Cargando y en estado critico"
        "BatStatus.10" = "Desconocido"
        "BatStatus.11" = "En espera (idle)"
        "BatStatus.Default" = "No disponible"

        "Det.WU.Ok"   = "Servicio wuauserv detenido y deshabilitado correctamente."
        "Det.WU.Fail" = "No se pudo detener/deshabilitar wuauserv: {0}"
        "Det.Activation.Ok"        = "Windows esta activado. ({0})"
        "Det.Activation.NotActive" = "Windows NO esta activado."
        "Det.Activation.Warn"      = "No se pudo consultar el estado de activacion: {0}"
        "Det.Drivers.Fail" = "Dispositivos con errores de controlador: {0}"
        "Det.Drivers.Ok"   = "No se detectaron dispositivos con errores de controlador."
        "Det.Drivers.Warn" = "Error al consultar dispositivos PnP: {0}"
        "Det.DriverVer.NoList"      = "Sin lista de drivers configurada todavia (pendiente de definir)."
        "Det.DriverVer.NotFound"    = "No se encontro un driver instalado que coincida con '{0}'."
        "Det.DriverVer.Ok"          = "{0}: version {1} (minima requerida: {2})."
        "Det.DriverVer.TooLow"      = "{0}: version {1} es menor a la minima requerida ({2})."
        "Det.DriverVer.CompareWarn" = "No se pudo comparar la version de '{0}': {1}"
        "Det.DriverVer.Warn"        = "Error al validar versiones de drivers: {0}"
        "Det.Battery.NotFound"  = "Equipo de escritorio o bateria no detectada."
        "Det.Battery.WithHealth" = "Bateria {0} - Carga: {1}% | Estado: {2} | Salud: {3}%"
        "Det.Battery.NoHealth"  = "Bateria {0} - Carga: {1}% | Estado: {2} | Salud: no disponible"
        "Det.Battery.Warn"      = "No se pudo consultar la bateria: {0}"
        "Det.Wifi.NotFound"   = "No se detecto adaptador WiFi."
        "Det.Wifi.Connecting" = "Intentando conectar automaticamente a '{0}'..."
        "Det.Wifi.Info"       = "Adaptador: {0} | Habilitado: {1} | Conectado: {2} | SSID: {3}"
        "Det.Wifi.Warn"       = "Error al consultar adaptadores WiFi: {0}"
        "Det.BT.NotFound"      = "No se detecto hardware Bluetooth."
        "Det.BT.CouldNotEnable"= "Bluetooth detectado pero no se pudo activar."
        "Det.BT.NearbyFound"   = "Bluetooth activado. Dispositivos cercanos/emparejados: {0}"
        "Det.BT.NoNearby"      = "Bluetooth activado. No se detectaron dispositivos cercanos/emparejados."
        "Det.BT.Warn"          = "Error al consultar/activar Bluetooth: {0}"
        "Wifi.Popup.NoData"  = "No se pudieron listar redes WiFi (adaptador deshabilitado o busqueda no soportada)."
        "Wifi.Popup.Error"   = "Error al listar redes WiFi: {0}"
        "BT.Popup.NoData"    = "No se encontraron dispositivos Bluetooth."
        "BT.Popup.Error"     = "Error al listar dispositivos Bluetooth: {0}"
        "Det.WWAN.Found"    = "Adaptador celular detectado: {0}"
        "Det.WWAN.NotFound" = "No se detecto adaptador WWAN/celular."
        "Det.WWAN.Warn"     = "Error al consultar adaptadores WWAN: {0}"
        "Det.Optical.Found"     = "Unidad detectada: {0}"
        "Det.Optical.Ejected"   = "Bandeja expulsada en unidad {0}"
        "Det.Optical.EjectWarn" = "No se pudo expulsar la bandeja de {0}: {1}"
        "Det.Optical.NotFound"  = "No se detecto unidad optica fisica."
        "Det.Optical.Warn"      = "Error al consultar unidad optica: {0}"
        "Det.DVD.Skipped" = "No se detecto unidad optica fisica; prueba interactiva omitida."
        "Det.DVD.Detail"  = "Verificacion de lectura de disco realizada por el usuario."
        "Det.DVD.Warn"    = "Error al probar la unidad optica: {0}"
        "Det.BIOS.Info" = "Version: {0}"
        "Det.BIOS.Warn" = "Error al consultar informacion de BIOS: {0}"
        "Det.Computer.Info" = "Modelo: {0} | Serie: {1}"
        "Det.Uptime.Info" = "Tiempo activo: {0} horas"
        "Det.Uptime.Warn" = "Error al calcular el tiempo de actividad: {0}"
        "Det.CPU.Info" = "{0} | Nucleos: {1} | Threads: {2}"
        "Det.CPU.Warn" = "Error al consultar el procesador: {0}"
        "Det.RAM.Info"         = "Capacidad instalada: {0} GB | Modulos: {1} | Velocidad: {2} MHz"
        "Det.RAM.Module"       = "Modulo {0}: {1} | Modelo: {2} | Serie: {3} | {4} MHz | {5} GB"
        "Det.RAM.MoreThanTwo"  = "El equipo tiene mas de 2 modulos ({0}); solo los dos primeros se listan en la exportacion."
        "Det.RAM.NotFound"     = "No se pudo obtener informacion de memoria fisica."
        "Det.RAM.Warn"         = "Error al consultar la memoria RAM: {0}"
        "Det.Disk.Info"        = "{0} | Modelo: {1} | Serie: {2} | {3} GB"
        "Det.Disk.MoreThanOne" = "El equipo tiene mas de un disco fisico ({0}); solo el primero se usa en la exportacion."
        "Det.Disk.LogicalInfo" = "Unidad {0} - Espacio libre: {1} GB de {2} GB"
        "Det.Disk.Warn"        = "Error al consultar discos: {0}"
        "Det.SMART.Info"      = "Dispositivo: {0} | Falla predicha: {1}"
        "Det.SMART.NotFound"  = "No se encontraron entradas SMART disponibles."
        "Det.SMART.Warn"      = "No se pudo obtener el estado SMART (puede requerir permisos adicionales o no estar soportado): {0}"
        "Det.GPU.Info" = "Modelo: {0} | VRAM: {1} GB | Driver: {2}"
        "Det.GPU.Warn" = "Error al consultar la GPU: {0}"
        "Det.Display.Info" = "Resolucion actual: {0}x{1} | Cantidad de monitores: {2}"
        "Det.Display.Warn" = "Error al consultar la pantalla: {0}"
        "Det.USB.NoPorts"   = "No se especificaron puertos probados."
        "Det.USB.Result"    = "{0} de {1} puertos funcionaron ({2}%). Controladores USB detectados: {3}."
        "Det.USB.NotFound"  = "No se detecto controlador USB en este equipo; prueba omitida."
        "Det.USB.Warn"      = "Error al probar los puertos USB: {0}"
        "Det.Camera.Result"   = "Verificacion visual realizada por el usuario en la app de Camara."
        "Det.Camera.NotFound" = "No se detecto camara en este equipo; prueba omitida."
        "Det.Camera.Warn"     = "No se pudo abrir la aplicacion de camara: {0}"
        "Det.Audio.Result"   = "Prueba de altavoces (tono generado: canal izquierdo y luego derecho)."
        "Det.Audio.NotFound" = "No se detecto dispositivo de audio en este equipo; prueba omitida."
        "Det.Audio.Warn"     = "Error al reproducir el sonido de prueba: {0}"
        "Det.Mic.Result"   = "Verificacion realizada mediante Configuracion de Sonido de Windows."
        "Det.Mic.NotFound" = "No se detecto dispositivo de audio en este equipo; prueba de microfono omitida."
        "Det.Mic.Warn"     = "No se pudo abrir la configuracion de sonido: {0}"
        "Det.Keyboard.Tool"     = "Prueba realizada con herramienta dedicada: {0}"
        "Det.Keyboard.Manual"   = "Prueba manual solicitada al usuario (no se encontro KeyTest)."
        "Det.Keyboard.NotFound" = "No se detecto teclado en este equipo; prueba omitida."
        "Det.Keyboard.Warn"     = "Error al probar el teclado: {0}"
        "Det.Touchpad.Result"   = "Verificacion manual realizada por el usuario."
        "Det.Touchpad.NotFound" = "No se detecto touchpad en este equipo; prueba omitida."
        "Det.Touchpad.Warn"     = "Error al probar el touchpad: {0}"
        "Det.TouchScreen.HW"   = "Hardware detectado: {0}"
        "Det.TouchScreen.NA"   = "No disponible."
        "Det.TouchScreen.Warn" = "Error al verificar pantalla tactil: {0}"
        "Det.Biometric.HW"       = "Hardware detectado: {0}"
        "Det.Biometric.NotFound" = "No se detecto lector biometrico."
        "Det.Biometric.Warn"     = "Error al verificar lector biometrico: {0}"
        "Det.SmartCard.Result"   = "Verificacion manual realizada por el usuario."
        "Det.SmartCard.NotFound" = "No se detecto lector de SmartCard en este equipo; prueba omitida."
        "Det.SmartCard.Warn"     = "Error al probar el lector SmartCard: {0}"
        "Det.Barcode.Result"   = "Verificacion manual realizada por el usuario."
        "Det.Barcode.NotFound" = "No se detecto lector de codigo de barras en este equipo; prueba omitida."
        "Det.Barcode.Warn"     = "Error al probar el lector de codigo de barras: {0}"
        "Det.GPS.Result"   = "Verificacion manual realizada por el usuario."
        "Det.GPS.NotFound" = "No se detecto GPS en este equipo; prueba omitida."
        "Det.GPS.Warn"     = "Error al probar el GPS: {0}"
        "Det.Stylus.Result"   = "Verificacion manual realizada por el usuario."
        "Det.Stylus.NotFound" = "No se detecto stylus/digitalizador en este equipo; prueba omitida."
        "Det.Stylus.Warn"     = "Error al probar el stylus: {0}"
        "Det.ScreenTest.Result" = "Verificacion visual realizada por el usuario (blanco/negro/rojo/verde/azul/gris 50%)."
        "Det.ScreenTest.Warn"   = "Error al ejecutar la prueba de pantalla: {0}"
        "Det.Port.Result"   = "Verificacion manual realizada por el usuario."
        "Det.Port.NotFound" = "{0}: no detectado en este equipo; prueba omitida."
        "Det.Ports.Warn"    = "Error al probar los puertos: {0}"
    }
}
#endregion Variables


#region Funciones
function Tx {
    <#
        Traduce una clave del diccionario $Global:Textos al idioma activo
        ($Global:Idioma). Si se pasan valores adicionales, se aplican con el
        operador -f (placeholders {0}, {1}, ...). Si la clave no existe en el
        idioma activo, cae de respaldo a "EN"; si tampoco existe ahi, devuelve la
        clave tal cual (para nunca romper la interfaz).
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Clave,
        [Parameter(ValueFromRemainingArguments = $true)][object[]]$Valores
    )
    try {
        $tabla = $Global:Textos[$Global:Idioma]
        $plantilla = $null
        if ($tabla -and $tabla.ContainsKey($Clave)) { $plantilla = $tabla[$Clave] }
        if (-not $plantilla -and $Global:Textos["EN"].ContainsKey($Clave)) { $plantilla = $Global:Textos["EN"][$Clave] }
        if (-not $plantilla) { return $Clave }
        if ($Valores -and $Valores.Count -gt 0) { return ($plantilla -f $Valores) }
        return $plantilla
    }
    catch {
        return $Clave
    }
}

function Add-Result {
    <# Agrega un resultado normalizado al arreglo global $Global:Resultados. #>
    param(
        [Parameter(Mandatory = $true)][string]$Componente,
        [Parameter(Mandatory = $true)][ValidateSet('PASS', 'FAIL', 'WARNING', 'INFO')][string]$Estado,
        [Parameter(Mandatory = $true)][string]$Detalle
    )
    try {
        $obj = [PSCustomObject]@{
            Componente = $Componente
            Estado     = $Estado
            Detalle    = $Detalle
        }
        $Global:Resultados += $obj

        $color = switch ($Estado) {
            'PASS'    { 'Green' }
            'FAIL'    { 'Red' }
            'WARNING' { 'Yellow' }
            'INFO'    { 'Cyan' }
            default   { 'White' }
        }
        Write-Host ("  [{0,-7}] {1} - {2}" -f $Estado, $Componente, $Detalle) -ForegroundColor $color
    }
    catch {
        Write-Host "Add-Result internal error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Test-EsAdministrador {
    try {
        $identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identidad)
        return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    catch {
        Write-Host "Could not verify privilege level: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Import-ConfiguracionWifi {
    <# Reads the WiFi SSID/password from wifi-config.txt, next to this script, instead of
       keeping real network credentials in the .ps1 source itself - important now that this
       tool's source is meant to be shared/published. Called once during the Main pre-flight,
       before Test-Wifi ever runs (console pre-flight or "Start Automatic Diagnostics").

       wifi-config.txt format (see the template shipped alongside this script):
           SSID=NetworkName
           Password=NetworkPassword
       Lines starting with # are ignored. Leave Password blank if the SSID is already saved
       as a profile in Windows - the script will just connect to it without building one.
       If the file is missing or SSID is blank, WiFi auto-connect is simply skipped and the
       test only reports the adapter's status. #>
    try {
        $carpetaScript = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Path $PSCommandPath -Parent } else { $null }
        if (-not $carpetaScript) { return }
        $rutaConfig = Join-Path -Path $carpetaScript -ChildPath "wifi-config.txt"
        if (-not (Test-Path -Path $rutaConfig -ErrorAction SilentlyContinue)) { return }

        $ssid = $null
        $password = $null
        foreach ($linea in Get-Content -Path $rutaConfig -ErrorAction Stop) {
            $l = $linea.Trim()
            if (-not $l -or $l.StartsWith("#")) { continue }
            if ($l -match '(?i)^SSID\s*=\s*(.*)$') { $ssid = $Matches[1].Trim() }
            elseif ($l -match '(?i)^Password\s*=\s*(.*)$') { $password = $Matches[1].Trim() }
        }

        if ($ssid) {
            $Global:WifiSSID = $ssid
            if ($password) {
                $Global:WifiPassword = $password
                $Global:WifiUsarPerfilGuardado = $false
            }
            else {
                $Global:WifiPassword = $null
                $Global:WifiUsarPerfilGuardado = $true
            }
        }
    }
    catch {
        Write-Host "Could not read wifi-config.txt: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Invoke-PruebaMedida {
    <# Runs one test's action, timing it. If Patrones is supplied, any previous results matching
       those Componente patterns are cleared first so re-running a test (e.g. clicking the same
       dashboard tile again) replaces its old outcome instead of stacking on top of it - otherwise
       an old FAIL would keep "winning" forever against a later PASS via Get-EstadoComponente's
       worst-status logic. #>
    param(
        [Parameter(Mandatory = $true)][string]$Nombre,
        [Parameter(Mandatory = $true)][scriptblock]$Accion,
        [string[]]$Patrones
    )
    Write-Host ""
    Write-Host ">> Running test: $Nombre..." -ForegroundColor DarkCyan
    if ($Patrones) {
        foreach ($patron in $Patrones) {
            $Global:Resultados = @($Global:Resultados | Where-Object { $_.Componente -notlike $patron })
        }
    }
    $cronometro = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & $Accion
    }
    catch {
        Add-Result $Nombre "WARNING" "Unhandled exception during the test: $($_.Exception.Message)"
    }
    finally {
        $cronometro.Stop()
        $segundos = [math]::Round($cronometro.Elapsed.TotalSeconds, 2)
        $Global:TiemposEjecucion[$Nombre] = $segundos
        Write-Host "   Elapsed time: $segundos s" -ForegroundColor DarkGray
    }
}

function Get-EstadoBateria {
    param([int]$Codigo)
    $clave = "BatStatus.$Codigo"
    return Tx $clave
}

function Format-GB {
    param([double]$Bytes)
    if (-not $Bytes) { return 0 }
    return [math]::Round($Bytes / 1GB, 2)
}

function Get-EstadoComponente {
    param([Parameter(Mandatory = $true)][string]$Patron)
    try {
        $coincidencias = $Global:Resultados | Where-Object { $_.Componente -like $Patron }
        if (-not $coincidencias) { return "N/A" }
        if ($coincidencias | Where-Object { $_.Estado -eq 'FAIL' })    { return "FAIL" }
        if ($coincidencias | Where-Object { $_.Estado -eq 'WARNING' }) { return "WARNING" }
        if ($coincidencias | Where-Object { $_.Estado -eq 'PASS' })    { return "PASS" }
        return "INFO"
    }
    catch {
        return "N/A"
    }
}

function Get-PeorEstado {
    param([Parameter(Mandatory = $true)][string[]]$Estados)
    $prioridad = @{ 'FAIL' = 0; 'WARNING' = 1; 'PASS' = 2; 'INFO' = 3; 'N/A' = 4 }
    return ($Estados | Sort-Object { $prioridad[$_] })[0]
}

function Get-EstadoMultiple {
    <# Worst-of status across one or more Componente patterns (wraps Get-EstadoComponente + Get-PeorEstado). #>
    param([Parameter(Mandatory = $true)][string[]]$Patrones)
    $estados = @($Patrones | ForEach-Object { Get-EstadoComponente -Patron $_ })
    return Get-PeorEstado -Estados $estados
}

function Invoke-WpfDoEvents {
    try {
        $marco = New-Object System.Windows.Threading.DispatcherFrame
        $callback = [System.Windows.Threading.DispatcherOperationCallback]{
            param($f)
            $f.Continue = $false
            return $null
        }
        [void][System.Windows.Threading.Dispatcher]::CurrentDispatcher.BeginInvoke(
            [System.Windows.Threading.DispatcherPriority]::Background, $callback, $marco)
        [System.Windows.Threading.Dispatcher]::PushFrame($marco)
    }
    catch { }
}
#endregion Funciones


#region Pruebas Automaticas
function Test-WindowsUpdateService {
    try {
        $servicio = Get-Service -Name 'wuauserv' -ErrorAction Stop
        if ($servicio.Status -ne 'Stopped') { Stop-Service -Name 'wuauserv' -Force -ErrorAction Stop }
        Set-Service -Name 'wuauserv' -StartupType Disabled -ErrorAction Stop
        Add-Result "Windows Update" "PASS" (Tx "Det.WU.Ok")
    }
    catch {
        Add-Result "Windows Update" "FAIL" (Tx "Det.WU.Fail" $_.Exception.Message)
    }
}

function Test-WindowsActivation {
    try {
        $licencias = Get-CimInstance -ClassName SoftwareLicensingProduct -ErrorAction Stop |
            Where-Object { $_.PartialProductKey -and $_.ApplicationID -eq '55c92734-d682-4d71-983e-d6ec3f16059f' }
        $activo = $licencias | Where-Object { $_.LicenseStatus -eq 1 }
        if ($activo) {
            Add-Result "Windows Activation" "PASS" (Tx "Det.Activation.Ok" $activo[0].Name)
        }
        else {
            Add-Result "Windows Activation" "FAIL" (Tx "Det.Activation.NotActive")
        }
    }
    catch {
        Add-Result "Windows Activation" "WARNING" (Tx "Det.Activation.Warn" $_.Exception.Message)
    }
}

function Test-Drivers {
    try {
        $dispositivos = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.ConfigManagerErrorCode -ne 0 }
        if ($dispositivos) {
            $nombres = ($dispositivos | Select-Object -ExpandProperty Name -Unique) -join ", "
            Add-Result "Drivers" "FAIL" (Tx "Det.Drivers.Fail" $nombres)
        }
        else {
            Add-Result "Drivers" "PASS" (Tx "Det.Drivers.Ok")
        }
    }
    catch {
        Add-Result "Drivers" "WARNING" (Tx "Det.Drivers.Warn" $_.Exception.Message)
    }
}

function Test-VersionesDrivers {
    try {
        if (-not $Global:DriversEsperados -or $Global:DriversEsperados.Count -eq 0) {
            Add-Result "Driver Versions" "INFO" (Tx "Det.DriverVer.NoList")
            return
        }
        $driversInstalados = Get-CimInstance -ClassName Win32_PnPSignedDriver -ErrorAction Stop
        foreach ($esperado in $Global:DriversEsperados) {
            $coincidencia = $driversInstalados | Where-Object { $_.DeviceName -match [regex]::Escape($esperado.Nombre) } | Select-Object -First 1
            if (-not $coincidencia) {
                Add-Result "Driver Versions" "FAIL" (Tx "Det.DriverVer.NotFound" $esperado.Nombre)
                continue
            }
            try {
                $versionInstalada = [version]$coincidencia.DriverVersion
                $versionMinima = [version]$esperado.VersionMinima
                if ($versionInstalada -ge $versionMinima) {
                    Add-Result "Driver Versions" "PASS" (Tx "Det.DriverVer.Ok" $coincidencia.DeviceName $versionInstalada $versionMinima)
                }
                else {
                    Add-Result "Driver Versions" "FAIL" (Tx "Det.DriverVer.TooLow" $coincidencia.DeviceName $versionInstalada $versionMinima)
                }
            }
            catch {
                Add-Result "Driver Versions" "WARNING" (Tx "Det.DriverVer.CompareWarn" $esperado.Nombre $_.Exception.Message)
            }
        }
    }
    catch {
        Add-Result "Driver Versions" "WARNING" (Tx "Det.DriverVer.Warn" $_.Exception.Message)
    }
}

function Test-Battery {
    try {
        $baterias = Get-CimInstance -ClassName Win32_Battery -ErrorAction Stop
        if (-not $baterias) {
            Add-Result "Battery" "WARNING" (Tx "Det.Battery.NotFound")
            return
        }

        try {
            $carpetaScript = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Path $PSCommandPath -Parent } else { $null }
            if ($carpetaScript) {
                $rutaBatteryInfoView = Join-Path -Path $carpetaScript -ChildPath "BatteryInfoView.exe"
                if (Test-Path -Path $rutaBatteryInfoView -ErrorAction SilentlyContinue) {
                    Start-Process -FilePath $rutaBatteryInfoView -ErrorAction SilentlyContinue
                }
            }
        }
        catch { }

        $disenoLista = @(Get-CimInstance -Namespace "root\wmi" -ClassName BatteryStaticData -ErrorAction SilentlyContinue)
        $cargaLista  = @(Get-CimInstance -Namespace "root\wmi" -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue)

        $indice = 0
        foreach ($b in $baterias) {
            $indice++
            $estadoTexto = Get-EstadoBateria -Codigo $b.BatteryStatus

            $capDiseno = if ($disenoLista.Count -ge $indice) { $disenoLista[$indice - 1].DesignedCapacity } else { $null }
            $capActual = if ($cargaLista.Count -ge $indice) { $cargaLista[$indice - 1].FullChargedCapacity } else { $null }

            $salud = $null
            if ($capDiseno -and $capDiseno -gt 0 -and $capActual) {
                $salud = [math]::Round(($capActual / $capDiseno) * 100, 0)
            }

            if ($null -ne $salud) {
                $estado = if ($salud -ge 80) { "PASS" } elseif ($salud -ge 50) { "WARNING" } else { "FAIL" }
                Add-Result "Battery" $estado (Tx "Det.Battery.WithHealth" $indice $b.EstimatedChargeRemaining $estadoTexto $salud)
            }
            else {
                Add-Result "Battery" "INFO" (Tx "Det.Battery.NoHealth" $indice $b.EstimatedChargeRemaining $estadoTexto)
            }

            $valorExportacion = if ($null -ne $salud) { "$salud%" } else { "N/D" }
            if ($indice -eq 1) { $Global:DatosExportacion.Battery1 = $valorExportacion }
            if ($indice -eq 2) { $Global:DatosExportacion.Battery2 = $valorExportacion }
        }
    }
    catch {
        Add-Result "Battery" "WARNING" (Tx "Det.Battery.Warn" $_.Exception.Message)
    }
}

function Get-SSIDActual {
    try {
        $salidaNetsh = netsh wlan show interfaces 2>$null
        $lineaSsid = $salidaNetsh | Select-String '^\s*SSID\s*:' | Select-Object -First 1
        if ($lineaSsid) { return ($lineaSsid.Line -split ':', 2)[1].Trim() }
        return $null
    }
    catch {
        return $null
    }
}

function Connect-WifiAutomatico {
    if (-not $Global:WifiSSID) { return $false }
    try {
        if (-not $Global:WifiUsarPerfilGuardado) {
            $ssidHex = ($Global:WifiSSID.ToCharArray() | ForEach-Object { '{0:X2}' -f [byte]$_ }) -join ''
            $perfilXml = @"
<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>$($Global:WifiSSID)</name>
    <SSIDConfig>
        <SSID>
            <hex>$ssidHex</hex>
            <name>$($Global:WifiSSID)</name>
        </SSID>
    </SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <MSM>
        <security>
            <authEncryption>
                <authentication>WPA2PSK</authentication>
                <encryption>AES</encryption>
                <useOneX>false</useOneX>
            </authEncryption>
            <sharedKey>
                <keyType>passPhrase</keyType>
                <protected>false</protected>
                <keyMaterial>$($Global:WifiPassword)</keyMaterial>
            </sharedKey>
        </security>
    </MSM>
</WLANProfile>
"@
            $rutaPerfilTemp = Join-Path -Path $env:TEMP -ChildPath "wifi-profile-temp.xml"
            Set-Content -Path $rutaPerfilTemp -Value $perfilXml -Encoding UTF8
            netsh wlan add profile filename="$rutaPerfilTemp" user=all | Out-Null
            Remove-Item -Path $rutaPerfilTemp -Force -ErrorAction SilentlyContinue
        }
        netsh wlan connect name="$($Global:WifiSSID)" ssid="$($Global:WifiSSID)" | Out-Null
        Start-Sleep -Seconds 5
        return ((Get-SSIDActual) -eq $Global:WifiSSID)
    }
    catch {
        return $false
    }
}

function Test-Wifi {
    try {
        $adaptadores = Get-CimInstance -ClassName Win32_NetworkAdapter -ErrorAction Stop |
            Where-Object {
                $_.Name -match 'Wireless|Wi-?Fi|802\.11' -and
                $_.PNPDeviceID -and
                $_.PhysicalAdapter -and
                $_.Name -notmatch 'Virtual|Hosted Network|Direct Virtual|Miniport'
            }

        if (-not $adaptadores) {
            Add-Result "WiFi" "WARNING" (Tx "Det.Wifi.NotFound")
            return
        }

        if ($Global:WifiSSID -and (Get-SSIDActual) -ne $Global:WifiSSID) {
            Add-Result "WiFi" "INFO" (Tx "Det.Wifi.Connecting" $Global:WifiSSID)
            [void](Connect-WifiAutomatico)
        }

        foreach ($a in $adaptadores) {
            $habilitado = [bool]$a.NetEnabled
            $conectado  = ($a.NetConnectionStatus -eq 2)
            $ssid = Get-SSIDActual
            $estado = if ($conectado) { "PASS" } elseif ($habilitado) { "WARNING" } else { "FAIL" }
            Add-Result "WiFi" $estado (Tx "Det.Wifi.Info" $a.Name $habilitado $conectado $ssid)
        }
    }
    catch {
        Add-Result "WiFi" "WARNING" (Tx "Det.Wifi.Warn" $_.Exception.Message)
    }
}

function Test-Bluetooth {
    try {
        $dispositivosBt = Get-PnpDevice -Class Bluetooth -ErrorAction Stop
        if (-not $dispositivosBt) {
            Add-Result "Bluetooth" "WARNING" (Tx "Det.BT.NotFound")
            return
        }

        $deshabilitados = $dispositivosBt | Where-Object { $_.Status -ne 'OK' }
        foreach ($d in $deshabilitados) {
            try { Enable-PnpDevice -InstanceId $d.InstanceId -Confirm:$false -ErrorAction Stop } catch { }
        }

        try {
            $servicioBt = Get-Service -Name 'bthserv' -ErrorAction SilentlyContinue
            if ($servicioBt -and $servicioBt.Status -ne 'Running') { Start-Service -Name 'bthserv' -ErrorAction SilentlyContinue }
        }
        catch { }

        Start-Sleep -Seconds 2
        $dispositivosBt = Get-PnpDevice -Class Bluetooth -ErrorAction Stop
        $activos = $dispositivosBt | Where-Object { $_.Status -eq 'OK' }

        if (-not $activos) {
            Add-Result "Bluetooth" "FAIL" (Tx "Det.BT.CouldNotEnable")
            return
        }

        $patronRuido = 'Enumerator|RFCOMM|Personal Area Network|Bluetooth Device \(|^Bluetooth$|Generic Bluetooth'
        $dispositivosCercanos = $activos | Where-Object { $_.FriendlyName -and $_.FriendlyName -notmatch $patronRuido }

        if ($dispositivosCercanos) {
            $nombres = ($dispositivosCercanos | Select-Object -ExpandProperty FriendlyName -Unique) -join ", "
            Add-Result "Bluetooth" "PASS" (Tx "Det.BT.NearbyFound" $nombres)
        }
        else {
            Add-Result "Bluetooth" "PASS" (Tx "Det.BT.NoNearby")
        }
    }
    catch {
        Add-Result "Bluetooth" "WARNING" (Tx "Det.BT.Warn" $_.Exception.Message)
    }
}

function Test-WWAN {
    try {
        $wwan = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.Name -match 'WWAN|Cellular|Mobile Broadband' }
        if ($wwan) {
            $nombres = ($wwan | Select-Object -ExpandProperty Name -Unique) -join ", "
            Add-Result "WWAN" "PASS" (Tx "Det.WWAN.Found" $nombres)
        }
        else {
            Add-Result "WWAN" "INFO" (Tx "Det.WWAN.NotFound")
        }
    }
    catch {
        Add-Result "WWAN" "WARNING" (Tx "Det.WWAN.Warn" $_.Exception.Message)
    }
}

function Test-OpticalDrive {
    try {
        $dvd = Get-CimInstance -ClassName Win32_CDROMDrive -ErrorAction Stop
        if ($dvd) {
            $nombres = ($dvd | Select-Object -ExpandProperty Name -Unique) -join ", "
            Add-Result "Optical Drive" "PASS" (Tx "Det.Optical.Found" $nombres)

            foreach ($unidad in $dvd) {
                if ($unidad.Drive) {
                    try {
                        $shell = New-Object -ComObject Shell.Application
                        $shell.Namespace(17).ParseName($unidad.Drive).InvokeVerb("Eject")
                        Add-Result "Optical Drive" "INFO" (Tx "Det.Optical.Ejected" $unidad.Drive)
                    }
                    catch {
                        Add-Result "Optical Drive" "WARNING" (Tx "Det.Optical.EjectWarn" $unidad.Drive $_.Exception.Message)
                    }
                }
            }
        }
        else {
            Add-Result "Optical Drive" "INFO" (Tx "Det.Optical.NotFound")
        }
    }
    catch {
        Add-Result "Optical Drive" "WARNING" (Tx "Det.Optical.Warn" $_.Exception.Message)
    }
}

function Test-BIOS {
    try {
        $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction Stop
        $sistema = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
        $producto = Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction SilentlyContinue

        $serieEquipo = if ($bios.SerialNumber) { $bios.SerialNumber.Trim() } else { "" }
        if (-not $serieEquipo -or $serieEquipo -match 'To Be Filled|Default string|System Serial Number|0123456789|None') {
            if ($producto -and $producto.IdentifyingNumber) { $serieEquipo = $producto.IdentifyingNumber.Trim() }
        }
        if (-not $serieEquipo) { $serieEquipo = "Not available" }

        Add-Result "BIOS" "INFO" (Tx "Det.BIOS.Info" $bios.SMBIOSBIOSVersion)

        $modelo = if ($sistema) { $sistema.Model } else { "Unknown" }
        Add-Result "Computer" "INFO" (Tx "Det.Computer.Info" $modelo $serieEquipo)
        $Global:DatosExportacion.SerialModel = "$modelo / $serieEquipo"
    }
    catch {
        Add-Result "BIOS" "WARNING" (Tx "Det.BIOS.Warn" $_.Exception.Message)
    }
}

function Test-Uptime {
    try {
        $so = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
        $ultimoArranque = $so.LastBootUpTime
        $tiempoActivo = (Get-Date) - $ultimoArranque
        $horasActivo = [math]::Round($tiempoActivo.TotalHours, 1)
        Add-Result "Uptime" "INFO" (Tx "Det.Uptime.Info" $horasActivo)
    }
    catch {
        Add-Result "Uptime" "WARNING" (Tx "Det.Uptime.Warn" $_.Exception.Message)
    }
}

function Test-CPU {
    try {
        $procesadores = Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop
        foreach ($cpu in $procesadores) {
            Add-Result "CPU" "INFO" (Tx "Det.CPU.Info" $cpu.Name $cpu.NumberOfCores $cpu.NumberOfLogicalProcessors)
        }
    }
    catch {
        Add-Result "CPU" "WARNING" (Tx "Det.CPU.Warn" $_.Exception.Message)
    }
}

function Test-RAM {
    try {
        $modulos = Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction Stop
        if ($modulos) {
            $totalGB = Format-GB -Bytes (($modulos | Measure-Object -Property Capacity -Sum).Sum)
            $velocidad = ($modulos | Select-Object -First 1 -ExpandProperty Speed)
            Add-Result "RAM" "INFO" (Tx "Det.RAM.Info" $totalGB $modulos.Count $velocidad)

            $listaModulos = @($modulos)
            $datosModulos = @()
            for ($i = 0; $i -lt $listaModulos.Count; $i++) {
                $m = $listaModulos[$i]
                $capModuloGB = Format-GB -Bytes $m.Capacity
                $fabricante = if ($m.Manufacturer) { $m.Manufacturer.Trim() } else { "Not available" }
                $numeroParte = if ($m.PartNumber) { $m.PartNumber.Trim() } else { "Not available" }
                $serieModulo = if ($m.SerialNumber) { $m.SerialNumber.Trim() } else { "Not available" }
                $velocidadModulo = $m.Speed

                Add-Result "RAM" "INFO" (Tx "Det.RAM.Module" ($i + 1) $fabricante $numeroParte $serieModulo $velocidadModulo $capModuloGB)
                $datosModulos += "$capModuloGB GB - $fabricante - $numeroParte"
            }

            if ($datosModulos.Count -ge 1) { $Global:DatosExportacion.RAM1 = $datosModulos[0] }
            if ($datosModulos.Count -ge 2) { $Global:DatosExportacion.RAM2 = $datosModulos[1] }
            if ($listaModulos.Count -gt 2) {
                Add-Result "RAM" "INFO" (Tx "Det.RAM.MoreThanTwo" $listaModulos.Count)
            }
        }
        else {
            Add-Result "RAM" "WARNING" (Tx "Det.RAM.NotFound")
        }
    }
    catch {
        Add-Result "RAM" "WARNING" (Tx "Det.RAM.Warn" $_.Exception.Message)
    }
}

function Test-Disco {
    try {
        $discosFisicos = Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction Stop
        $primerDisco = $true
        $totalDiscos = @($discosFisicos).Count
        foreach ($d in $discosFisicos) {
            $capacidadGB = Format-GB -Bytes $d.Size
            $serieDisco = if ($d.SerialNumber) { $d.SerialNumber.Trim() } else { "Not available" }
            $marcaDisco = if ($d.Manufacturer -and $d.Manufacturer -notmatch 'Standard disk drives') {
                $d.Manufacturer.Trim()
            }
            elseif ($d.Model) {
                ($d.Model.Trim() -split '\s+')[0]
            }
            else {
                "Not available"
            }
            Add-Result "Disk" "INFO" (Tx "Det.Disk.Info" $marcaDisco $d.Model $serieDisco $capacidadGB)

            if ($primerDisco) {
                $Global:DatosExportacion.SizeDisk = "$capacidadGB GB"
                $Global:DatosExportacion.SerialDisk = $serieDisco
                $primerDisco = $false
            }
        }
        if ($totalDiscos -gt 1) {
            Add-Result "Disk" "INFO" (Tx "Det.Disk.MoreThanOne" $totalDiscos)
        }

        $discosLogicos = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction Stop
        foreach ($l in $discosLogicos) {
            $libreGB = Format-GB -Bytes $l.FreeSpace
            $totalGB = Format-GB -Bytes $l.Size
            Add-Result "Disk" "INFO" (Tx "Det.Disk.LogicalInfo" $l.DeviceID $libreGB $totalGB)
        }
    }
    catch {
        Add-Result "Disk" "WARNING" (Tx "Det.Disk.Warn" $_.Exception.Message)
    }
    # Note: a SMART status sub-check via MSStorageDriver_FailurePredictStatus used to run here, but
    # that WMI class is frequently inaccessible (permissions/driver support vary a lot across disk
    # controllers) even when the tool is already running elevated, so it kept surfacing a confusing
    # "needs additional permissions" warning on machines where it simply isn't supported. Dropped in
    # favor of just reporting the disk inventory above.
}

function Test-GPU {
    try {
        $gpus = Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop
        foreach ($g in $gpus) {
            $vramGB = Format-GB -Bytes $g.AdapterRAM
            Add-Result "GPU" "INFO" (Tx "Det.GPU.Info" $g.Name $vramGB $g.DriverVersion)
        }
    }
    catch {
        Add-Result "GPU" "WARNING" (Tx "Det.GPU.Warn" $_.Exception.Message)
    }
}

function Test-Pantalla {
    try {
        $pantallas = [System.Windows.Forms.Screen]::AllScreens
        $principal = [System.Windows.Forms.Screen]::PrimaryScreen
        Add-Result "Display" "INFO" (Tx "Det.Display.Info" $principal.Bounds.Width $principal.Bounds.Height $pantallas.Count)
    }
    catch {
        Add-Result "Display" "WARNING" (Tx "Det.Display.Warn" $_.Exception.Message)
    }
}

function Invoke-PruebasAutomaticas {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " PHASE 1: AUTOMATIC TESTS" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    $pruebas = $Global:CatalogoPruebasAutomaticas

    if ($Global:UI -and $Global:UI.BarraProgreso) {
        $Global:UI.BarraProgreso.Minimum = 0
        $Global:UI.BarraProgreso.Maximum = $pruebas.Count
        $Global:UI.BarraProgreso.Value = 0
        if ($Global:UI.LblProgresoPorcentaje) { $Global:UI.LblProgresoPorcentaje.Text = "0%" }
        $Global:FiltroEstadoActual = "ALL"
        Update-EstiloFiltros
    }

    $contador = 0
    foreach ($clave in $pruebas.Keys) {
        $contador++
        try {
            if ($Global:UI -and $Global:UI.LblEstadoActual) {
                $Global:UI.LblEstadoActual.Text = Tx "Progress.Running" $contador $pruebas.Count $clave
                $Global:UI.BarraProgreso.Value = $contador
                if ($Global:UI.LblProgresoPorcentaje) {
                    $Global:UI.LblProgresoPorcentaje.Text = "$([math]::Round(($contador / $pruebas.Count) * 100))%"
                }
                Invoke-WpfDoEvents
            }
        }
        catch { }

        Invoke-PruebaMedida -Nombre $clave -Accion $pruebas[$clave].Accion -Patrones $pruebas[$clave].Patrones
        Update-ListaResultados
        Update-FilaSidebarEstado -Nombre $clave -Patrones $pruebas[$clave].Patrones
        Invoke-WpfDoEvents
    }

    if ($Global:UI -and $Global:UI.LblEstadoActual) { $Global:UI.LblEstadoActual.Text = Tx "Progress.Phase1Done" }

    Write-Host ""
    Write-Host "Phase 1 completed." -ForegroundColor Cyan
}
#endregion Pruebas Automaticas


#region Pruebas Interactivas
function New-BotonEstilo {
    param(
        [Parameter(Mandatory = $true)][string]$Texto,
        [string]$ColorFondo = "#0A84FF",
        [string]$ColorFondoHover = "#3399FF"
    )
    $boton = New-Object System.Windows.Controls.Button
    $boton.Content = $Texto
    $boton.Margin = New-Object System.Windows.Thickness(6, 0, 0, 0)
    Set-EstiloBoton -Boton $boton -ColorFondo $ColorFondo -ColorFondoHover $ColorFondoHover
    return $boton
}

function Set-EstiloBoton {
    param(
        [Parameter(Mandatory = $true)][System.Windows.Controls.Button]$Boton,
        [string]$ColorFondo = "#0A84FF",
        [string]$ColorFondoHover = "#3399FF"
    )
    try {
        $Boton.Foreground = [System.Windows.Media.Brushes]::White
        $Boton.FontWeight = 'SemiBold'
        $Boton.BorderThickness = New-Object System.Windows.Thickness(0)
        $Boton.Padding = New-Object System.Windows.Thickness(16, 8, 16, 8)
        $Boton.Cursor = [System.Windows.Input.Cursors]::Hand

        $plantillaXaml = @"
<ControlTemplate xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" TargetType="Button">
    <Border Name="bd" Background="$ColorFondo" CornerRadius="6" Padding="{TemplateBinding Padding}">
        <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
    </Border>
    <ControlTemplate.Triggers>
        <Trigger Property="IsMouseOver" Value="True">
            <Setter TargetName="bd" Property="Background" Value="$ColorFondoHover"/>
        </Trigger>
        <Trigger Property="IsEnabled" Value="False">
            <Setter TargetName="bd" Property="Opacity" Value="0.4"/>
        </Trigger>
    </ControlTemplate.Triggers>
</ControlTemplate>
"@
        $lector = New-Object System.Xml.XmlNodeReader ([xml]$plantillaXaml)
        $Boton.Template = [Windows.Markup.XamlReader]::Load($lector)
    }
    catch { }
}

function Show-DialogoBotones {
    param(
        [Parameter(Mandatory = $true)][string]$Mensaje,
        [string]$Titulo = $null,
        [Parameter(Mandatory = $true)][array]$Opciones
    )
    if (-not $Titulo) { $Titulo = Tx "Dialog.Title" }
    $mensajeSeguro = [System.Security.SecurityElement]::Escape($Mensaje)
    $tituloSeguro = [System.Security.SecurityElement]::Escape($Titulo)

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="$tituloSeguro" Height="200" Width="560"
        WindowStartupLocation="CenterOwner" Background="#1E1E1E" ResizeMode="NoResize"
        ShowInTaskbar="False" WindowStyle="ToolWindow">
    <Grid Margin="24">
        <Grid.RowDefinitions>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <TextBlock Grid.Row="0" Text="$mensajeSeguro" Foreground="#EAEAEA" FontSize="15" TextWrapping="Wrap" VerticalAlignment="Center"/>
        <StackPanel Grid.Row="1" Orientation="Horizontal" HorizontalAlignment="Right" Name="panelBotones" Margin="0,20,0,0"/>
    </Grid>
</Window>
"@
    $lector = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
    $dlg = [Windows.Markup.XamlReader]::Load($lector)
    try { if ($Global:UI -and $Global:UI.Ventana) { $dlg.Owner = $Global:UI.Ventana } } catch { }

    $panel = $dlg.FindName("panelBotones")
    # The answer is stashed directly on the $dlg object (instead of the old $script:__resultadoDialogo
    # variable) because writes to a script-scoped variable from inside a .GetNewClosure() click handler
    # were not reliably propagating back out - that's what caused answers to read back as empty/null.
    $dlg | Add-Member -NotePropertyName ResultadoBoton -NotePropertyValue $null -Force

    foreach ($opcion in $Opciones) {
        $boton = New-BotonEstilo -Texto $opcion.Texto -ColorFondo $opcion.Color -ColorFondoHover $opcion.ColorHover
        $boton.Tag = $opcion.Valor
        $boton.Add_Click({
            $dlg.ResultadoBoton = $this.Tag
            $dlg.DialogResult = $true
        }.GetNewClosure())
        [void]$panel.Children.Add($boton)
    }

    [void]$dlg.ShowDialog()
    return $dlg.ResultadoBoton
}

function Show-DialogoEntrada {
    param(
        [Parameter(Mandatory = $true)][string]$Mensaje,
        [switch]$SoloNumeros,
        [switch]$PermitirVacio
    )
    $mensajeSeguro = [System.Security.SecurityElement]::Escape($Mensaje)
    $tituloSeguro = [System.Security.SecurityElement]::Escape((Tx "Dialog.Title"))

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="$tituloSeguro" Height="220" Width="480"
        WindowStartupLocation="CenterOwner" Background="#1E1E1E" ResizeMode="NoResize"
        ShowInTaskbar="False" WindowStyle="ToolWindow">
    <Grid Margin="24">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <TextBlock Grid.Row="0" Text="$mensajeSeguro" Foreground="#EAEAEA" FontSize="15" TextWrapping="Wrap"/>
        <TextBox Grid.Row="1" Name="txtEntrada" Margin="0,16,0,0" Padding="8" FontSize="14" Background="#2B2B2B" Foreground="#FFFFFF" BorderBrush="#0A84FF" BorderThickness="1" CaretBrush="White"/>
        <StackPanel Grid.Row="2" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,20,0,0" Name="panelBotones"/>
    </Grid>
</Window>
"@
    $lector = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
    $dlg = [Windows.Markup.XamlReader]::Load($lector)
    try { if ($Global:UI -and $Global:UI.Ventana) { $dlg.Owner = $Global:UI.Ventana } } catch { }

    $caja = $dlg.FindName("txtEntrada")
    $panel = $dlg.FindName("panelBotones")
    $dlg | Add-Member -NotePropertyName ResultadoTexto -NotePropertyValue $null -Force

    $btnAceptar = New-BotonEstilo -Texto (Tx "Dialog.Accept") -ColorFondo "#0A84FF" -ColorFondoHover "#3399FF"
    $btnAceptar.Add_Click({
        $texto = $caja.Text
        if (-not $PermitirVacio -and [string]::IsNullOrWhiteSpace($texto)) { return }
        if ($SoloNumeros -and $texto -notmatch '^\d+$') { return }
        $dlg.ResultadoTexto = $texto
        $dlg.DialogResult = $true
    }.GetNewClosure())
    [void]$panel.Children.Add($btnAceptar)

    $dlg.Add_ContentRendered({ $caja.Focus() | Out-Null }.GetNewClosure())
    [void]$dlg.ShowDialog()
    return $dlg.ResultadoTexto
}

function Wait-Confirmacion {
    param([Parameter(Mandatory = $true)][string]$Mensaje)
    $opciones = @(@{ Texto = (Tx "Dialog.Continue"); Valor = "OK"; Color = "#0A84FF"; ColorHover = "#3399FF" })
    [void](Show-DialogoBotones -Mensaje $Mensaje -Opciones $opciones)
}

function Show-DialogoInfo {
    param([Parameter(Mandatory = $true)][string]$Mensaje, [string]$Titulo = $null)
    if (-not $Titulo) { $Titulo = Tx "Dialog.Title" }
    $opciones = @(@{ Texto = (Tx "Dialog.Accept"); Valor = "OK"; Color = "#0A84FF"; ColorHover = "#3399FF" })
    [void](Show-DialogoBotones -Mensaje $Mensaje -Titulo $Titulo -Opciones $opciones)
}

function Get-ColorMasClaro {
    <# Brightens a "#RRGGBB" color by $Cantidad per channel (clamped to 255) - used to derive a
       hover shade for a button from whatever accent color a popup is using, without having to
       hand-pick a matching hover color for every accent. #>
    param([Parameter(Mandatory = $true)][string]$Hex, [int]$Cantidad = 28)
    try {
        $color = [System.Windows.Media.ColorConverter]::ConvertFromString($Hex)
        $r = [Math]::Min(255, [int]$color.R + $Cantidad)
        $g = [Math]::Min(255, [int]$color.G + $Cantidad)
        $b = [Math]::Min(255, [int]$color.B + $Cantidad)
        return ('#{0:X2}{1:X2}{2:X2}' -f $r, $g, $b)
    }
    catch {
        return $Hex
    }
}

function Show-DialogoTexto {
    <# Read-only, scrollable popup for longer content (WiFi networks, Bluetooth devices, or any
       multi-line test result). Show-DialogoBotones is sized for a short question and would clip
       long lists, so this one adds a ScrollViewer and a taller window, plus a colored icon header
       and a card-style content area so each popup type (WiFi/Bluetooth/generic) reads at a glance. #>
    param(
        [Parameter(Mandatory = $true)][string]$Mensaje,
        [string]$Titulo = $null,
        [int]$Icono = 0xE946,
        [string]$ColorAcento = "#0A84FF"
    )
    if (-not $Titulo) { $Titulo = Tx "Dialog.Title" }
    $mensajeSeguro = [System.Security.SecurityElement]::Escape($Mensaje)
    $tituloSeguro = [System.Security.SecurityElement]::Escape($Titulo)
    $iconoChar = [System.Security.SecurityElement]::Escape([string][char]$Icono)
    $colorHover = Get-ColorMasClaro -Hex $ColorAcento

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="$tituloSeguro" Height="480" Width="580"
        WindowStartupLocation="CenterOwner" Background="#141414" ResizeMode="NoResize"
        ShowInTaskbar="False" WindowStyle="ToolWindow" Topmost="True">
    <Border BorderBrush="$ColorAcento" BorderThickness="1" CornerRadius="10" Margin="6">
        <Grid Margin="20">
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <StackPanel Grid.Row="0" Orientation="Horizontal" Margin="0,0,0,14">
                <Border Width="36" Height="36" CornerRadius="18" Background="$ColorAcento">
                    <TextBlock Text="$iconoChar" FontFamily="Segoe MDL2 Assets" FontSize="17" Foreground="White" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                </Border>
                <TextBlock Text="$tituloSeguro" Foreground="#F2F2F2" FontSize="18" FontWeight="Bold" VerticalAlignment="Center" Margin="12,0,0,0"/>
            </StackPanel>

            <Border Grid.Row="1" Background="#0E0E0E" CornerRadius="8" Padding="14" BorderBrush="#2A2A2A" BorderThickness="1">
                <ScrollViewer VerticalScrollBarVisibility="Auto">
                    <TextBlock Text="$mensajeSeguro" Foreground="#D8D8D8" FontSize="13" TextWrapping="Wrap" FontFamily="Consolas"/>
                </ScrollViewer>
            </Border>

            <StackPanel Grid.Row="2" Orientation="Horizontal" HorizontalAlignment="Right" Name="panelBotones" Margin="0,16,0,0"/>
        </Grid>
    </Border>
</Window>
"@
    $lector = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
    $dlg = [Windows.Markup.XamlReader]::Load($lector)
    try { if ($Global:UI -and $Global:UI.Ventana) { $dlg.Owner = $Global:UI.Ventana } } catch { }

    $panel = $dlg.FindName("panelBotones")
    $boton = New-BotonEstilo -Texto (Tx "Dialog.Accept") -ColorFondo $ColorAcento -ColorFondoHover $colorHover
    $boton.Add_Click({ $dlg.DialogResult = $true }.GetNewClosure())
    [void]$panel.Children.Add($boton)

    [void]$dlg.ShowDialog()
}

function Show-PopupRedesWifi {
    <# Shows the WiFi tile's popup: just SSID + signal strength for each visible network, parsed
       out of "netsh wlan show networks mode=Bssid" (that mode is what makes netsh report Signal
       per network in the first place). Falls back to the raw netsh output if parsing doesn't find
       anything - e.g. on a localized Windows where the "SSID"/"Signal" labels differ - so the popup
       never ends up empty even if the simplified parsing misses. #>
    try {
        $lineas = netsh wlan show networks mode=Bssid 2>&1
        $redes = [ordered]@{}
        $ssidActual = $null
        foreach ($linea in $lineas) {
            if ($linea -match '^\s*SSID\s+\d+\s*:\s*(.*)$') {
                $ssidActual = $Matches[1].Trim()
                if (-not $ssidActual) { $ssidActual = $null }
            }
            elseif ($ssidActual -and $linea -match '^\s*(?:Signal|Se[nñ]al)\s*:\s*(\d+)\s*%') {
                $senal = [int]$Matches[1]
                if (-not $redes.Contains($ssidActual) -or $senal -gt $redes[$ssidActual]) {
                    $redes[$ssidActual] = $senal
                }
            }
        }

        if ($redes.Count -gt 0) {
            $texto = ($redes.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
                "{0,4}%   {1}" -f $_.Value, $_.Key
            }) -join "`r`n"
        }
        else {
            $texto = ($lineas | Out-String).Trim()
            if (-not $texto) { $texto = Tx "Wifi.Popup.NoData" }
        }
        Show-DialogoTexto -Mensaje $texto -Titulo (Tx "Side.WiFi") -Icono 0xE701 -ColorAcento "#29B6F6"
    }
    catch {
        Show-DialogoTexto -Mensaje (Tx "Wifi.Popup.Error" $_.Exception.Message) -Titulo (Tx "Side.WiFi") -Icono 0xE701 -ColorAcento "#29B6F6"
    }
}

function Show-PopupDispositivosBluetooth {
    <# Shows the Bluetooth tile's popup: paired/nearby Bluetooth devices only - the local radio's
       own chipset/controller and generic enumerator/service entries (which Get-PnpDevice also
       lists under the Bluetooth class) are filtered out using the same noise pattern Test-Bluetooth
       already uses to decide what counts as a "nearby" device. #>
    try {
        $patronRuido = 'Enumerator|RFCOMM|Personal Area Network|Bluetooth Device \(|^Bluetooth$|Generic Bluetooth|Bluetooth Radio|Bluetooth Adapter|Bluetooth LE|Handsfree|Bluetooth Peripheral|Bluetooth Hands-?free'
        $dispositivos = @(Get-PnpDevice -Class Bluetooth -ErrorAction Stop | Where-Object {
            $_.FriendlyName -and $_.FriendlyName -notmatch $patronRuido
        })
        if ($dispositivos.Count -gt 0) {
            $texto = ($dispositivos | Sort-Object FriendlyName -Unique | ForEach-Object {
                "- $($_.FriendlyName)  [$($_.Status)]"
            }) -join "`r`n"
        }
        else {
            $texto = Tx "BT.Popup.NoData"
        }
        Show-DialogoTexto -Mensaje $texto -Titulo (Tx "Side.Bluetooth") -Icono 0xE702 -ColorAcento "#5C6BC0"
    }
    catch {
        Show-DialogoTexto -Mensaje (Tx "BT.Popup.Error" $_.Exception.Message) -Titulo (Tx "Side.Bluetooth") -Icono 0xE702 -ColorAcento "#5C6BC0"
    }
}

function Show-PopupResultadoPrueba {
    <# Generic popup for the rest of the automatic tiles: shows the Detalle text of whatever this
       test just logged (matching its Patrones), so clicking a tile always surfaces something on
       screen instead of only appending silently to the results list at the bottom. #>
    param(
        [Parameter(Mandatory = $true)][string[]]$Patrones,
        [Parameter(Mandatory = $true)][string]$Titulo
    )
    try {
        $coincidencias = @($Global:Resultados | Where-Object {
            $componente = $_.Componente
            [bool]($Patrones | Where-Object { $componente -like $_ })
        })
        if ($coincidencias.Count -eq 0) { return }
        $texto = ($coincidencias | ForEach-Object { "[$($_.Estado)] $($_.Detalle)" }) -join "`r`n`r`n"
        Show-DialogoTexto -Mensaje $texto -Titulo $Titulo -Icono 0xE946 -ColorAcento "#0A84FF"
    }
    catch { }
}

function Show-DialogoConfirmacion {
    param([Parameter(Mandatory = $true)][string]$Mensaje, [string]$Titulo = $null)
    if (-not $Titulo) { $Titulo = Tx "Dialog.Title" }
    $opciones = @(
        @{ Texto = (Tx "Dialog.Yes"); Valor = "SI"; Color = "#2E7D32"; ColorHover = "#388E3C" },
        @{ Texto = (Tx "Dialog.No");  Valor = "NO"; Color = "#546E7A"; ColorHover = "#607D8B" }
    )
    $resultado = Show-DialogoBotones -Mensaje $Mensaje -Titulo $Titulo -Opciones $opciones
    return ($resultado -eq "SI")
}

function Ask-PassFail {
    <# Re-shows the dialog instead of silently defaulting to FAIL if it's ever dismissed without
       a button click (e.g. buried behind an external testing tool and closed by mistake), so an
       unanswered question never gets recorded as a false failure. #>
    param([Parameter(Mandatory = $true)][string]$Pregunta)
    $opciones = @(
        @{ Texto = (Tx "Dialog.Pass"); Valor = "PASS"; Color = "#2E7D32"; ColorHover = "#388E3C" },
        @{ Texto = (Tx "Dialog.Fail"); Valor = "FAIL"; Color = "#C62828"; ColorHover = "#D32F2F" }
    )
    $resultado = $null
    while (-not $resultado) {
        $resultado = Show-DialogoBotones -Mensaje $Pregunta -Opciones $opciones
    }
    return $resultado
}

function Ask-YesNoNA {
    param([Parameter(Mandatory = $true)][string]$Pregunta)
    $opciones = @(
        @{ Texto = (Tx "Dialog.Yes"); Valor = "SI"; Color = "#2E7D32"; ColorHover = "#388E3C" },
        @{ Texto = (Tx "Dialog.No");  Valor = "NO"; Color = "#C62828"; ColorHover = "#D32F2F" },
        @{ Texto = (Tx "Dialog.NA");  Valor = "NA"; Color = "#546E7A"; ColorHover = "#607D8B" }
    )
    $resultado = Show-DialogoBotones -Mensaje $Pregunta -Opciones $opciones
    if (-not $resultado) { return "NA" }
    return $resultado
}

function Ask-Number {
    param([Parameter(Mandatory = $true)][string]$Pregunta)
    $valor = Show-DialogoEntrada -Mensaje (Tx "Dialog.NumbersOnly" $Pregunta) -SoloNumeros
    if (-not $valor) { return 0 }
    return [int]$valor
}

function Ask-Texto {
    param([Parameter(Mandatory = $true)][string]$Pregunta)
    $valor = Show-DialogoEntrada -Mensaje $Pregunta -PermitirVacio
    if ($null -eq $valor) { return "" }
    return $valor
}

function Convert-RespuestaAEstado {
    param([string]$Respuesta)
    switch ($Respuesta) {
        "SI" { return "PASS" }
        "NO" { return "FAIL" }
        default { return "INFO" }
    }
}

function Preguntar-InfoOrden {
    <# Asks, once per session, whether this service is tied to a work order, and if so, its
       number - replaces the old always-visible "Order / ticket number" field from the removed
       Settings tab. Called right before the report is actually saved/exported, from whichever
       path gets there first (Guided Tests finishing, a manual Export Excel click, or closing the
       app with a pending export) - the $Global:OrdenPreguntada guard makes the other call sites
       no-ops so the technician is never asked twice. #>
    if ($Global:OrdenPreguntada) { return }
    $Global:OrdenPreguntada = $true
    try {
        if (Show-DialogoConfirmacion (Tx "Ask.IsOrder") (Tx "Ask.IsOrderTitle")) {
            $Global:DatosExportacion.Order = Ask-Texto (Tx "Ask.OrderNumber")
        }
    }
    catch { }
}

function Test-USB-Interactivo {
    try {
        $controladores = Get-CimInstance -ClassName Win32_USBController -ErrorAction Stop
        $cantidad = ($controladores | Measure-Object).Count

        if ($cantidad -le 0) {
            Add-Result "USB" "INFO" (Tx "Det.USB.NotFound")
            return
        }

        Wait-Confirmacion (Tx "Ask.USBWait" $cantidad)

        $totalPuertos = Ask-Number (Tx "Ask.USBTotal")
        if ($totalPuertos -le 0) {
            Add-Result "USB" "WARNING" (Tx "Det.USB.NoPorts")
            return
        }
        $funcionaron = Ask-Number (Tx "Ask.USBWorking")

        $porcentaje = [math]::Round(($funcionaron / $totalPuertos) * 100, 0)
        $estado = if ($porcentaje -eq 100) { "PASS" } elseif ($porcentaje -ge 50) { "WARNING" } else { "FAIL" }
        Add-Result "USB" $estado (Tx "Det.USB.Result" $funcionaron $totalPuertos $porcentaje $cantidad)
    }
    catch {
        Add-Result "USB" "WARNING" (Tx "Det.USB.Warn" $_.Exception.Message)
    }
}

function Test-DVD-Interactivo {
    try {
        $dvd = Get-CimInstance -ClassName Win32_CDROMDrive -ErrorAction Stop
        if (-not $dvd) {
            Add-Result "DVD" "INFO" (Tx "Det.DVD.Skipped")
            return
        }
        Wait-Confirmacion (Tx "Ask.DVDWait")
        $resultado = Ask-PassFail (Tx "Ask.DVDRead")
        Add-Result "DVD" $resultado (Tx "Det.DVD.Detail")
    }
    catch {
        Add-Result "DVD" "WARNING" (Tx "Det.DVD.Warn" $_.Exception.Message)
    }
}

function Test-Camara-Interactivo {
    try {
        $camara = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.PNPClass -eq 'Camera' -or $_.PNPClass -eq 'Image' -or $_.Name -match 'Camera|Webcam' }
        if (-not $camara) {
            Add-Result "Camera" "INFO" (Tx "Det.Camera.NotFound")
            return
        }

        Start-Process "microsoft.windows.camera:" -ErrorAction Stop
        Start-Sleep -Seconds 3
        $resultado = Ask-PassFail (Tx "Ask.Camera")
        Add-Result "Camera" $resultado (Tx "Det.Camera.Result")

        # The Camera app (a UWP app, "WindowsCamera") is left running by Start-Process above and
        # doesn't close itself - stop it now that the test is answered so it doesn't stay open on
        # top of the diagnostics window.
        try {
            Get-Process -Name "WindowsCamera" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        }
        catch { }
    }
    catch {
        Add-Result "Camera" "WARNING" (Tx "Det.Camera.Warn" $_.Exception.Message)
    }
}

function New-WavTonoEstereo {
    param(
        [int]$Frecuencia = 600,
        [double]$DuracionPorCanalSegundos = 0.6,
        [int]$MuestreoHz = 44100
    )
    $muestrasPorCanal = [int]($DuracionPorCanalSegundos * $MuestreoHz)
    $canales = 2
    $bytesPorMuestra = 2
    $tamDatos = $muestrasPorCanal * 2 * $canales * $bytesPorMuestra

    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    $ascii = [System.Text.Encoding]::ASCII

    $bw.Write($ascii.GetBytes("RIFF"))
    $bw.Write([int32](36 + $tamDatos))
    $bw.Write($ascii.GetBytes("WAVE"))
    $bw.Write($ascii.GetBytes("fmt "))
    $bw.Write([int32]16)
    $bw.Write([int16]1)
    $bw.Write([int16]$canales)
    $bw.Write([int32]$MuestreoHz)
    $bw.Write([int32]($MuestreoHz * $canales * $bytesPorMuestra))
    $bw.Write([int16]($canales * $bytesPorMuestra))
    $bw.Write([int16]16)
    $bw.Write($ascii.GetBytes("data"))
    $bw.Write([int32]$tamDatos)

    $amplitud = 12000

    for ($i = 0; $i -lt $muestrasPorCanal; $i++) {
        $valor = [int16]($amplitud * [math]::Sin(2 * [math]::PI * $Frecuencia * $i / $MuestreoHz))
        $bw.Write($valor)
        $bw.Write([int16]0)
    }
    for ($i = 0; $i -lt $muestrasPorCanal; $i++) {
        $valor = [int16]($amplitud * [math]::Sin(2 * [math]::PI * $Frecuencia * $i / $MuestreoHz))
        $bw.Write([int16]0)
        $bw.Write($valor)
    }

    $bw.Flush()
    [void]$ms.Seek(0, [System.IO.SeekOrigin]::Begin)
    return $ms
}

function Test-Audio-Interactivo {
    try {
        $dispositivoAudio = Get-CimInstance -ClassName Win32_SoundDevice -ErrorAction Stop
        if (-not $dispositivoAudio) {
            Add-Result "Audio" "INFO" (Tx "Det.Audio.NotFound")
            return
        }

        try {
            $wavEstereo = New-WavTonoEstereo
            $reproductor = New-Object System.Media.SoundPlayer($wavEstereo)
            $reproductor.PlaySync()
        }
        catch {
            [System.Media.SystemSounds]::Asterisk.Play()
            Start-Sleep -Milliseconds 800
        }
        $resultado = Ask-PassFail (Tx "Ask.Audio")
        Add-Result "Audio" $resultado (Tx "Det.Audio.Result")
    }
    catch {
        Add-Result "Audio" "WARNING" (Tx "Det.Audio.Warn" $_.Exception.Message)
    }
}

function Test-Microfono-Interactivo {
    try {
        $dispositivoAudio = Get-CimInstance -ClassName Win32_SoundDevice -ErrorAction Stop
        if (-not $dispositivoAudio) {
            Add-Result "Microphone" "INFO" (Tx "Det.Mic.NotFound")
            return
        }

        Start-Process "ms-settings:sound" -ErrorAction Stop
        $resultado = Ask-YesNoNA (Tx "Ask.Mic")
        $estado = Convert-RespuestaAEstado -Respuesta $resultado
        Add-Result "Microphone" $estado (Tx "Det.Mic.Result")
    }
    catch {
        Add-Result "Microphone" "WARNING" (Tx "Det.Mic.Warn" $_.Exception.Message)
    }
}

function Test-Teclado-Interactivo {
    try {
        $teclado = Get-CimInstance -ClassName Win32_Keyboard -ErrorAction Stop
        if (-not $teclado) {
            Add-Result "Keyboard" "INFO" (Tx "Det.Keyboard.NotFound")
            return
        }

        # keytest.exe is an optional bundled tool - it just needs to sit next to this script.
        $carpetaScript = if ($PSScriptRoot) { $PSScriptRoot } elseif ($PSCommandPath) { Split-Path -Path $PSCommandPath -Parent } else { $null }
        $RutaTeclado = if ($carpetaScript) { Join-Path -Path $carpetaScript -ChildPath "keytest.exe" } else { $null }

        if ($RutaTeclado -and (Test-Path -Path $RutaTeclado -ErrorAction SilentlyContinue)) {
            Start-Process -FilePath $RutaTeclado -ErrorAction Stop
            Start-Sleep -Seconds 2
            $resultado = Ask-YesNoNA (Tx "Ask.KeyboardTool")
            $estado = Convert-RespuestaAEstado -Respuesta $resultado
            Add-Result "Keyboard" $estado (Tx "Det.Keyboard.Tool" $RutaTeclado)
        }
        else {
            Wait-Confirmacion (Tx "Ask.KeyboardManualWait")
            $resultado = Ask-YesNoNA (Tx "Ask.KeyboardManual")
            $estado = Convert-RespuestaAEstado -Respuesta $resultado
            Add-Result "Keyboard" $estado (Tx "Det.Keyboard.Manual")
        }
    }
    catch {
        Add-Result "Keyboard" "WARNING" (Tx "Det.Keyboard.Warn" $_.Exception.Message)
    }
}

function Test-Touchpad-Interactivo {
    try {
        $touchpad = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.Name -match 'Touchpad|Touch Pad|Synaptics|ELAN|ALPS|Precision Touchpad' }
        if (-not $touchpad) {
            Add-Result "Touchpad" "INFO" (Tx "Det.Touchpad.NotFound")
            return
        }

        $resultado = Ask-YesNoNA (Tx "Ask.Touchpad")
        $estado = Convert-RespuestaAEstado -Respuesta $resultado
        Add-Result "Touchpad" $estado (Tx "Det.Touchpad.Result")
    }
    catch {
        Add-Result "Touchpad" "WARNING" (Tx "Det.Touchpad.Warn" $_.Exception.Message)
    }
}

function Test-PantallaTactil-Interactivo {
    try {
        $tactil = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.Name -match 'Touch ?Screen|HID-compliant touch' }
        if ($tactil) {
            $resultado = Ask-YesNoNA (Tx "Ask.TouchScreen")
            $estado = Convert-RespuestaAEstado -Respuesta $resultado
            $nombres = ($tactil | Select-Object -ExpandProperty Name -Unique) -join ", "
            Add-Result "Touch Screen" $estado (Tx "Det.TouchScreen.HW" $nombres)
        }
        else {
            Add-Result "Touch Screen" "INFO" (Tx "Det.TouchScreen.NA")
        }
    }
    catch {
        Add-Result "Touch Screen" "WARNING" (Tx "Det.TouchScreen.Warn" $_.Exception.Message)
    }
}

function Test-Biometrico-Interactivo {
    try {
        $bio = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.Name -match 'Fingerprint|Biometric' }
        if ($bio) {
            $resultado = Ask-YesNoNA (Tx "Ask.Biometric")
            $estado = Convert-RespuestaAEstado -Respuesta $resultado
            $nombres = ($bio | Select-Object -ExpandProperty Name -Unique) -join ", "
            Add-Result "Biometric Reader" $estado (Tx "Det.Biometric.HW" $nombres)
        }
        else {
            Add-Result "Biometric Reader" "INFO" (Tx "Det.Biometric.NotFound")
        }
    }
    catch {
        Add-Result "Biometric Reader" "WARNING" (Tx "Det.Biometric.Warn" $_.Exception.Message)
    }
}

function Test-SmartCard-Interactivo {
    try {
        $smartCard = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.PNPClass -eq 'SmartCardReader' -or $_.Name -match 'Smart ?Card' }
        if (-not $smartCard) {
            Add-Result "SmartCard Reader" "INFO" (Tx "Det.SmartCard.NotFound")
            return
        }

        $resultado = Ask-YesNoNA (Tx "Ask.SmartCard")
        $estado = Convert-RespuestaAEstado -Respuesta $resultado
        Add-Result "SmartCard Reader" $estado (Tx "Det.SmartCard.Result")
    }
    catch {
        Add-Result "SmartCard Reader" "WARNING" (Tx "Det.SmartCard.Warn" $_.Exception.Message)
    }
}

function Test-CodigoBarras-Interactivo {
    try {
        $barcode = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.Name -match 'Barcode|Scanner' }
        if (-not $barcode) {
            Add-Result "Barcode Reader" "INFO" (Tx "Det.Barcode.NotFound")
            return
        }

        $resultado = Ask-YesNoNA (Tx "Ask.Barcode")
        $estado = Convert-RespuestaAEstado -Respuesta $resultado
        Add-Result "Barcode Reader" $estado (Tx "Det.Barcode.Result")
    }
    catch {
        Add-Result "Barcode Reader" "WARNING" (Tx "Det.Barcode.Warn" $_.Exception.Message)
    }
}

function Test-GPS-Interactivo {
    try {
        $gps = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.Name -match 'GPS|GNSS' -or $_.PNPClass -eq 'SensorsAndLocation' }
        if (-not $gps) {
            Add-Result "GPS" "INFO" (Tx "Det.GPS.NotFound")
            return
        }

        $resultado = Ask-YesNoNA (Tx "Ask.GPS")
        $estado = Convert-RespuestaAEstado -Respuesta $resultado
        Add-Result "GPS" $estado (Tx "Det.GPS.Result")
    }
    catch {
        Add-Result "GPS" "WARNING" (Tx "Det.GPS.Warn" $_.Exception.Message)
    }
}

function Test-Stylus-Interactivo {
    try {
        $stylus = Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.Name -match 'Pen|Stylus|Digitizer' }
        if (-not $stylus) {
            Add-Result "Stylus" "INFO" (Tx "Det.Stylus.NotFound")
            return
        }

        Wait-Confirmacion (Tx "Ask.StylusWait")
        $resultado = Ask-YesNoNA (Tx "Ask.Stylus")
        $estado = Convert-RespuestaAEstado -Respuesta $resultado
        Add-Result "Stylus" $estado (Tx "Det.Stylus.Result")
    }
    catch {
        Add-Result "Stylus" "WARNING" (Tx "Det.Stylus.Warn" $_.Exception.Message)
    }
}

function Get-BrilloPantallaActual {
    <# Reads the current display brightness (0-100) via the laptop panel's WMI brightness
       interface. Returns $null if unavailable (external monitors, desktops, and some laptops
       don't expose this - it's not supported over DDC/CI, only the internal panel via ACPI). #>
    try {
        $info = Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1
        if ($info) { return [int]$info.CurrentBrightness }
        return $null
    }
    catch { return $null }
}

function Set-BrilloPantalla {
    <# Sets the internal panel's brightness (0-100) via WmiMonitorBrightnessMethods. Returns
       $true/$false so the caller can tell whether the change actually took effect (and
       therefore whether it's worth trying to restore the original value afterwards). #>
    param([Parameter(Mandatory = $true)][int]$Porcentaje)
    try {
        $metodos = Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Select-Object -First 1
        if (-not $metodos) { return $false }
        Invoke-CimMethod -InputObject $metodos -MethodName WmiSetBrightness -Arguments @{ Timeout = 0; Brightness = [byte]$Porcentaje } -ErrorAction Stop | Out-Null
        return $true
    }
    catch { return $false }
}

function Show-VentanaPruebaColores {
    <# Fullscreen, borderless window that cycles through solid test colors (pure white, pure
       black, pure red, pure green, pure blue, 50% gray) for a visual screen check - dead
       pixels, backlight uniformity/bleeding, color accuracy. The technician moves back and
       forth between colors with the on-screen buttons, the Left/Right arrow keys, or Space;
       Escape or the Close button ends the test immediately, from any color. #>
    $colores = @(
        @{ TxKey = "Color.White";  Hex = "#FFFFFF" },
        @{ TxKey = "Color.Black";  Hex = "#000000" },
        @{ TxKey = "Color.Red";    Hex = "#FF0000" },
        @{ TxKey = "Color.Green";  Hex = "#00FF00" },
        @{ TxKey = "Color.Blue";   Hex = "#0000FF" },
        @{ TxKey = "Color.Gray50"; Hex = "#808080" }
    )

    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowState="Maximized" WindowStyle="None" ResizeMode="NoResize"
        ShowInTaskbar="False" Topmost="True" Background="Black">
    <Grid>
        <Border Name="bordeColor" Background="White"/>
        <StackPanel VerticalAlignment="Bottom" HorizontalAlignment="Center" Margin="0,0,0,50">
            <Border Background="#CC1A1A1A" CornerRadius="10" Padding="16,12">
                <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                    <TextBlock Name="txtColorActual" Text="" Foreground="White" FontSize="16" FontWeight="Bold" VerticalAlignment="Center" Margin="0,0,20,0"/>
                    <StackPanel Name="panelBotones" Orientation="Horizontal" VerticalAlignment="Center"/>
                    <TextBlock Name="txtAyuda" Text="" Foreground="#AAAAAA" FontSize="12" VerticalAlignment="Center" Margin="20,0,0,0"/>
                </StackPanel>
            </Border>
        </StackPanel>
    </Grid>
</Window>
"@
    $lector = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
    $dlg = [Windows.Markup.XamlReader]::Load($lector)
    try { if ($Global:UI -and $Global:UI.Ventana) { $dlg.Owner = $Global:UI.Ventana } } catch { }

    $bordeColor = $dlg.FindName("bordeColor")
    $txtColorActual = $dlg.FindName("txtColorActual")
    $txtAyuda = $dlg.FindName("txtAyuda")
    $panelBotones = $dlg.FindName("panelBotones")
    $txtAyuda.Text = Tx "ScreenTest.Help"

    $dlg | Add-Member -NotePropertyName Indice -NotePropertyValue 0 -Force

    $actualizar = {
        $c = $colores[$dlg.Indice]
        $bordeColor.Background = ConvertTo-Brush $c.Hex
        $txtColorActual.Text = "{0}  ({1}/{2})" -f (Tx $c.TxKey), ($dlg.Indice + 1), $colores.Count
    }.GetNewClosure()

    $btnAnterior = New-BotonEstilo -Texto ("< " + (Tx "ScreenTest.Prev")) -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
    $btnAnterior.Add_Click({
        $dlg.Indice = ($dlg.Indice - 1 + $colores.Count) % $colores.Count
        & $actualizar
    }.GetNewClosure())
    [void]$panelBotones.Children.Add($btnAnterior)

    $btnSiguiente = New-BotonEstilo -Texto ((Tx "ScreenTest.Next") + " >") -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
    $btnSiguiente.Add_Click({
        $dlg.Indice = ($dlg.Indice + 1) % $colores.Count
        & $actualizar
    }.GetNewClosure())
    [void]$panelBotones.Children.Add($btnSiguiente)

    $btnCerrar = New-BotonEstilo -Texto ((Tx "ScreenTest.Close") + "  (Esc)") -ColorFondo "#C62828" -ColorFondoHover "#D32F2F"
    $btnCerrar.Add_Click({ $dlg.DialogResult = $true }.GetNewClosure())
    [void]$panelBotones.Children.Add($btnCerrar)

    # PreviewKeyDown (tunneling, fires on the Window before any child control sees the key) is
    # used instead of KeyDown so navigation works no matter which control currently has focus,
    # and so Space doesn't also trigger a Click on whichever button last had focus.
    $dlg.Add_PreviewKeyDown({
        param($origen, $e)
        switch ($e.Key) {
            'Right'  { $dlg.Indice = ($dlg.Indice + 1) % $colores.Count; & $actualizar; $e.Handled = $true }
            'Space'  { $dlg.Indice = ($dlg.Indice + 1) % $colores.Count; & $actualizar; $e.Handled = $true }
            'Left'   { $dlg.Indice = ($dlg.Indice - 1 + $colores.Count) % $colores.Count; & $actualizar; $e.Handled = $true }
            'Escape' { $dlg.DialogResult = $true; $e.Handled = $true }
        }
    }.GetNewClosure())

    & $actualizar
    [void]$dlg.ShowDialog()
}

function Test-PruebaColores-Interactivo {
    <# Fullscreen color-cycling visual check (white/black/red/green/blue/50% gray) for dead
       pixels, backlight uniformity and color accuracy. Brightness is bumped to maximum for
       the duration of the test (laptop panel only, via WMI) and restored to whatever it was
       before, once the technician closes the fullscreen view. #>
    try {
        $brilloOriginal = Get-BrilloPantallaActual
        $brilloAjustado = Set-BrilloPantalla -Porcentaje 100

        Show-VentanaPruebaColores

        if ($brilloAjustado -and $null -ne $brilloOriginal) {
            [void](Set-BrilloPantalla -Porcentaje $brilloOriginal)
        }

        $resultado = Ask-YesNoNA (Tx "Ask.ScreenTest")
        $estado = Convert-RespuestaAEstado -Respuesta $resultado
        Add-Result "Screen Test" $estado (Tx "Det.ScreenTest.Result")
    }
    catch {
        Add-Result "Screen Test" "WARNING" (Tx "Det.ScreenTest.Warn" $_.Exception.Message)
    }
}

function Test-Puertos-Interactivo {
    try {
        # HDMI, DisplayPort, USB-C and Thunderbolt cannot be reliably detected as physical
        # ports through WMI (Windows does not expose connector types independently of the
        # devices plugged into them), so those are still asked about directly. Ethernet and
        # the audio jack can be tied to real hardware (a wired NIC / a sound device), so
        # those are detected first and skipped if the corresponding hardware isn't present.
        $tieneEthernet = [bool](Get-CimInstance -ClassName Win32_NetworkAdapter -ErrorAction Stop |
            Where-Object { $_.PhysicalAdapter -and $_.Name -match 'Ethernet' -and $_.Name -notmatch 'Virtual|Bluetooth' })
        $tieneAudio = [bool](Get-CimInstance -ClassName Win32_SoundDevice -ErrorAction Stop)

        $puertos = @(
            @{ Nombre = "HDMI"; Detectable = $false; Presente = $true }
            @{ Nombre = "DisplayPort"; Detectable = $false; Presente = $true }
            @{ Nombre = "Ethernet"; Detectable = $true; Presente = $tieneEthernet }
            @{ Nombre = (Tx "Port.AudioJack"); Detectable = $true; Presente = $tieneAudio }
            @{ Nombre = "USB-C"; Detectable = $false; Presente = $true }
            @{ Nombre = "Thunderbolt"; Detectable = $false; Presente = $true }
        )

        foreach ($puerto in $puertos) {
            if ($puerto.Detectable -and -not $puerto.Presente) {
                Add-Result "Port $($puerto.Nombre)" "INFO" (Tx "Det.Port.NotFound" $puerto.Nombre)
                continue
            }
            $resultado = Ask-YesNoNA (Tx "Ask.Port" $puerto.Nombre)
            $estado = Convert-RespuestaAEstado -Respuesta $resultado
            Add-Result "Port $($puerto.Nombre)" $estado (Tx "Det.Port.Result")
        }
    }
    catch {
        Add-Result "Ports" "WARNING" (Tx "Det.Ports.Warn" $_.Exception.Message)
    }
}

function Invoke-PruebasInteractivas {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host " PHASE 2: GUIDED (INTERACTIVE) TESTS" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta

    $pruebas = $Global:CatalogoPruebasGuiadas

    foreach ($clave in $pruebas.Keys) {
        if ($Global:UI -and $Global:UI.LblEstadoActual) {
            $Global:UI.LblEstadoActual.Text = Tx "Progress.GuidedRunning" $clave
        }
        Invoke-PruebaMedida -Nombre $clave -Accion $pruebas[$clave].Accion -Patrones $pruebas[$clave].Patrones
        Update-ListaResultados
        Set-FilaSidebarCompletada -Nombre $clave
    }

    Write-Host ""
    Write-Host "Phase 2 completed." -ForegroundColor Magenta
}
#endregion Pruebas Interactivas


#region GUI
function Update-ListaResultados {
    try {
        if (-not ($Global:UI -and $Global:UI.ListaResultados)) { return }

        $datosFiltrados = $Global:Resultados
        if ($Global:FiltroEstadoActual -and $Global:FiltroEstadoActual -ne "ALL") {
            $datosFiltrados = $datosFiltrados | Where-Object { $_.Estado -eq $Global:FiltroEstadoActual }
        }
        $Global:UI.ListaResultados.ItemsSource = $null
        $Global:UI.ListaResultados.ItemsSource = @($datosFiltrados)

        if ($Global:UI.TxtStatTotal) {
            $Global:UI.TxtStatTotal.Text = "$($Global:Resultados.Count)"
            $Global:UI.TxtStatPass.Text = "$(($Global:Resultados | Where-Object { $_.Estado -eq 'PASS' }).Count)"
            $Global:UI.TxtStatFail.Text = "$(($Global:Resultados | Where-Object { $_.Estado -eq 'FAIL' }).Count)"
            $Global:UI.TxtStatWarning.Text = "$(($Global:Resultados | Where-Object { $_.Estado -eq 'WARNING' }).Count)"
        }
    }
    catch {
        Write-Host "Error refreshing the results list: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Update-EstiloFiltros {
    try {
        if (-not ($Global:UI -and $Global:UI.BtnFiltroAll)) { return }
        $botonesFiltro = @{
            "ALL"     = $Global:UI.BtnFiltroAll
            "PASS"    = $Global:UI.BtnFiltroPass
            "FAIL"    = $Global:UI.BtnFiltroFail
            "WARNING" = $Global:UI.BtnFiltroWarning
            "INFO"    = $Global:UI.BtnFiltroInfo
        }
        foreach ($clave in $botonesFiltro.Keys) {
            if ($clave -eq $Global:FiltroEstadoActual) {
                Set-EstiloBoton -Boton $botonesFiltro[$clave] -ColorFondo "#0A84FF" -ColorFondoHover "#3399FF"
            }
            else {
                Set-EstiloBoton -Boton $botonesFiltro[$clave] -ColorFondo "#2B2B2B" -ColorFondoHover "#3A3A3A"
            }
        }
    }
    catch { }
}

function Update-AnchoColumnasResultados {
    <# Keeps the results ListView's three GridView columns (Component/Status/Detail) sized to
       whatever width is actually available, instead of the fixed pixel widths the XAML starts
       with. Without this, the table looks fine at the one resolution it was designed for but
       either clips the Detail text (small/narrow screens) or leaves a lot of empty space
       (large/high-res screens). Wired to the ListView's SizeChanged event, so it re-runs
       automatically any time the window is resized, maximized, or moved to a different
       monitor. #>
    try {
        if (-not ($Global:UI -and $Global:UI.ListaResultados -and $Global:UI.ColComponente -and $Global:UI.ColEstado -and $Global:UI.ColDetalle)) { return }
        # -25 leaves room for the vertical scrollbar plus a small margin, so a horizontal
        # scrollbar doesn't appear just from rounding.
        $anchoDisponible = $Global:UI.ListaResultados.ActualWidth - 25
        if ($anchoDisponible -le 200) { return }

        $anchoEstado = 100
        $anchoComponente = [Math]::Max(140, [Math]::Round($anchoDisponible * 0.22))
        $anchoDetalle = $anchoDisponible - $anchoComponente - $anchoEstado
        if ($anchoDetalle -lt 200) { $anchoDetalle = 200 }

        $Global:UI.ColComponente.Width = $anchoComponente
        $Global:UI.ColEstado.Width = $anchoEstado
        $Global:UI.ColDetalle.Width = $anchoDetalle
    }
    catch { }
}

function ConvertTo-Brush {
    param([Parameter(Mandatory = $true)][string]$Hex)
    if ($Hex -eq "Transparent") { return [System.Windows.Media.Brushes]::Transparent }
    return New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.ColorConverter]::ConvertFromString($Hex))
}

function Get-ColorPuntoEstado {
    param([string]$Estado)
    switch ($Estado) {
        'PASS'    { return "#43A047" }
        'FAIL'    { return "#E53935" }
        'WARNING' { return "#FB8C00" }
        'INFO'    { return "#42A5F5" }
        default   { return "#5A5A5A" }
    }
}

function Get-ColorFondoFilaEstado {
    <# Tile background per result status - used to highlight a sidebar tile once its test has run.
       PASS/FAIL use solid, saturated colors so the whole button reads green/red at a glance. #>
    param([string]$Estado)
    switch ($Estado) {
        'PASS'    { return "#2E7D32" }
        'FAIL'    { return "#C62828" }
        'WARNING' { return "#EF6C00" }
        'INFO'    { return "#1565C0" }
        default   { return "#202020" }
    }
}

function Get-ColorFondoTileEstado {
    <# Icon-circle backdrop. Once a tile has a result, the whole tile background already carries the
       PASS/FAIL/WARNING/INFO color (see Get-ColorFondoFilaEstado), so the icon circle just needs a
       translucent overlay to stay visible on top of it rather than a second solid color. #>
    param([string]$Estado)
    switch ($Estado) {
        'PASS'    { return "#40FFFFFF" }
        'FAIL'    { return "#40FFFFFF" }
        'WARNING' { return "#40FFFFFF" }
        'INFO'    { return "#40FFFFFF" }
        default   { return "#3A3A3A" }
    }
}

function Get-CodigoIconoEstado {
    param([string]$Estado)
    switch ($Estado) {
        'PASS'    { return 0xE73E }
        'FAIL'    { return 0xE711 }
        'WARNING' { return 0xE7BA }
        'INFO'    { return 0xE946 }
        default   { return 0xE713 }
    }
}

function Update-FilaSidebarEstado {
    <# Colors an automatic-test tile by its actual result (PASS/FAIL/WARNING/INFO). Guided-test
       tiles use Set-FilaSidebarCompletada instead - see that function for why. #>
    param(
        [Parameter(Mandatory = $true)][string]$Nombre,
        [string[]]$Patrones
    )
    try {
        if (-not ($Global:UI -and $Global:UI.FilasSidebar -and $Global:UI.FilasSidebar.ContainsKey($Nombre))) { return }
        $descriptor = $Global:UI.FilasSidebar[$Nombre]
        $patronesUso = if ($Patrones) { $Patrones } else { $descriptor.Patrones }
        $estado = Get-EstadoMultiple -Patrones $patronesUso
        $descriptor.Fila.Background = ConvertTo-Brush (Get-ColorFondoFilaEstado -Estado $estado)
        $descriptor.Fila.BorderBrush = ConvertTo-Brush (Get-ColorPuntoEstado -Estado $estado)
        $descriptor.IconoBorde.Background = ConvertTo-Brush (Get-ColorFondoTileEstado -Estado $estado)
        $descriptor.Punto.Text = [char](Get-CodigoIconoEstado -Estado $estado)
        # Force an immediate render pass. Without this, a tile's new color can stay queued and
        # invisible until the next dialog/idle cycle happens to flush it - which is unreliable
        # for the guided-tests loop (it doesn't always show a dialog right after every test).
        Invoke-WpfDoEvents
    }
    catch {
        Write-Host "Error updating tile '$Nombre': $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Set-FilaSidebarCompletada {
    <# Guided-test tiles don't get PASS/FAIL/WARNING background coloring - the technician already
       saw and answered the result in a question dialog (Pass/Fail, Yes/No/N-A), so the tile only
       needs to confirm at a glance "this one is done", with a flat, consistent color regardless
       of what the answer was. #>
    param([Parameter(Mandatory = $true)][string]$Nombre)
    try {
        if (-not ($Global:UI -and $Global:UI.FilasSidebar -and $Global:UI.FilasSidebar.ContainsKey($Nombre))) { return }
        $descriptor = $Global:UI.FilasSidebar[$Nombre]
        $descriptor.Completada = $true
        $descriptor.Fila.Background = ConvertTo-Brush "#0A3D66"
        $descriptor.Fila.BorderBrush = ConvertTo-Brush "#0A84FF"
        $descriptor.IconoBorde.Background = ConvertTo-Brush "#40FFFFFF"
        $descriptor.Punto.Text = [char]0xE73E
        Invoke-WpfDoEvents
    }
    catch {
        Write-Host "Error marking tile '$Nombre' as completed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Invoke-PruebaSidebar {
    param([Parameter(Mandatory = $true)]$Descriptor)
    if ($Global:PruebaEnCurso) { return }
    try {
        $Global:PruebaEnCurso = $true
        if ($Global:UI -and $Global:UI.LblEstadoActual) {
            $Global:UI.LblEstadoActual.Text = Tx "Progress.RunningOne" (Tx $Descriptor.TxKey)
            Invoke-WpfDoEvents
        }
        Invoke-PruebaMedida -Nombre $Descriptor.Nombre -Accion $Descriptor.Accion -Patrones $Descriptor.Patrones
        Update-ListaResultados
        if ($Descriptor.EsGuiada) {
            # Guided tiles get a flat "done" indicator instead of PASS/FAIL/WARNING coloring -
            # the technician already answered the question in a dialog, so the tile just needs
            # to confirm it's been done. Automatic tiles surface their result in a popup as soon
            # as you click them. WiFi and Bluetooth get a specialized popup (networks / nearby
            # devices); everything else gets a plain popup with the message that was just logged.
            Set-FilaSidebarCompletada -Nombre $Descriptor.Nombre
        }
        else {
            Update-FilaSidebarEstado -Nombre $Descriptor.Nombre -Patrones $Descriptor.Patrones
            switch ($Descriptor.Nombre) {
                "WiFi"      { Show-PopupRedesWifi }
                "Bluetooth" { Show-PopupDispositivosBluetooth }
                default     { Show-PopupResultadoPrueba -Patrones $Descriptor.Patrones -Titulo (Tx $Descriptor.TxKey) }
            }
        }
        Update-BarraEstado
        if ($Global:UI -and $Global:UI.LblEstadoActual) { $Global:UI.LblEstadoActual.Text = Tx "Progress.Phase1Done" }
    }
    catch { }
    finally {
        $Global:PruebaEnCurso = $false
    }
}

function New-FilaSidebar {
    <# Builds one clickable dashboard tile (icon + label) for a single test. #>
    param(
        [Parameter(Mandatory = $true)][string]$Nombre,
        [Parameter(Mandatory = $true)][string]$TxKey,
        [Parameter(Mandatory = $true)][scriptblock]$Accion,
        [Parameter(Mandatory = $true)][string[]]$Patrones,
        [switch]$EsGuiada
    )
    $fila = New-Object System.Windows.Controls.Border
    $fila.Width = 106
    $fila.Height = 78
    $fila.Margin = New-Object System.Windows.Thickness(4)
    $fila.CornerRadius = 10
    $fila.Background = ConvertTo-Brush "#202020"
    $fila.BorderThickness = New-Object System.Windows.Thickness(0, 0, 0, 3)
    $fila.BorderBrush = ConvertTo-Brush (Get-ColorPuntoEstado -Estado "N/A")
    $fila.Cursor = [System.Windows.Input.Cursors]::Hand

    $panelInterno = New-Object System.Windows.Controls.StackPanel
    $panelInterno.Orientation = 'Vertical'
    $panelInterno.HorizontalAlignment = 'Center'
    $panelInterno.VerticalAlignment = 'Center'

    $iconoBorde = New-Object System.Windows.Controls.Border
    $iconoBorde.Width = 28
    $iconoBorde.Height = 28
    $iconoBorde.CornerRadius = 14
    $iconoBorde.Background = ConvertTo-Brush (Get-ColorFondoTileEstado -Estado "N/A")
    $iconoBorde.HorizontalAlignment = 'Center'
    $iconoBorde.Margin = New-Object System.Windows.Thickness(0, 0, 0, 6)

    $punto = New-Object System.Windows.Controls.TextBlock
    $punto.Text = [char](Get-CodigoIconoEstado -Estado "N/A")
    $punto.FontFamily = New-Object System.Windows.Media.FontFamily("Segoe MDL2 Assets")
    $punto.FontSize = 13
    $punto.Foreground = [System.Windows.Media.Brushes]::White
    $punto.HorizontalAlignment = 'Center'
    $punto.VerticalAlignment = 'Center'
    $iconoBorde.Child = $punto

    $texto = New-Object System.Windows.Controls.TextBlock
    $texto.Text = (Tx $TxKey)
    $texto.Foreground = [System.Windows.Media.Brushes]::Gainsboro
    $texto.FontSize = 10
    $texto.TextWrapping = 'Wrap'
    $texto.TextAlignment = 'Center'
    $texto.MaxWidth = 92
    $texto.HorizontalAlignment = 'Center'

    [void]$panelInterno.Children.Add($iconoBorde)
    [void]$panelInterno.Children.Add($texto)
    $fila.Child = $panelInterno

    $descriptor = [PSCustomObject]@{
        Nombre     = $Nombre
        TxKey      = $TxKey
        Accion     = $Accion
        Patrones   = $Patrones
        Fila       = $fila
        IconoBorde = $iconoBorde
        Punto      = $punto
        Texto      = $texto
        EsGuiada   = [bool]$EsGuiada
        Completada = $false
    }

    $fila.Add_MouseEnter({
        $fila.BorderBrush = ConvertTo-Brush "#0A84FF"
    }.GetNewClosure())

    $fila.Add_MouseLeave({
        if ($descriptor.EsGuiada -and $descriptor.Completada) {
            # Re-apply the flat "done" indicator - otherwise leaving the mouse would fall through
            # to the PASS/FAIL/WARNING coloring logic and undo it as soon as the hover ends.
            Set-FilaSidebarCompletada -Nombre $descriptor.Nombre
        }
        else {
            Update-FilaSidebarEstado -Nombre $descriptor.Nombre -Patrones $descriptor.Patrones
        }
    }.GetNewClosure())

    $fila.Add_MouseLeftButtonUp({
        Invoke-PruebaSidebar -Descriptor $descriptor
    }.GetNewClosure())

    return $descriptor
}

function Test-ComponenteDetectado {
    <# Returns $true if the catalog entry has no Detectar check (always shown, e.g. CPU/RAM/BIOS)
       or if its Detectar scriptblock confirms the hardware is present. Fails open (returns $true)
       if the WMI query itself errors, so a query hiccup never hides a component that may exist. #>
    param($Entrada)
    if (-not $Entrada.Detectar) { return $true }
    try {
        return [bool](& $Entrada.Detectar)
    }
    catch {
        return $true
    }
}

function Initialize-PanelSidebar {
    try {
        if (-not $Global:UI) { return }
        $Global:UI.FilasSidebar = @{}

        if ($Global:UI.PanelListaAutomaticas) {
            $Global:UI.PanelListaAutomaticas.Children.Clear()
            foreach ($clave in $Global:CatalogoPruebasAutomaticas.Keys) {
                $entrada = $Global:CatalogoPruebasAutomaticas[$clave]
                if (-not (Test-ComponenteDetectado -Entrada $entrada)) { continue }
                $descriptor = New-FilaSidebar -Nombre $clave -TxKey $entrada.TxKey -Accion $entrada.Accion -Patrones $entrada.Patrones
                [void]$Global:UI.PanelListaAutomaticas.Children.Add($descriptor.Fila)
                $Global:UI.FilasSidebar[$clave] = $descriptor
            }
        }

        if ($Global:UI.PanelListaGuiadas) {
            $Global:UI.PanelListaGuiadas.Children.Clear()
            foreach ($clave in $Global:CatalogoPruebasGuiadas.Keys) {
                $entrada = $Global:CatalogoPruebasGuiadas[$clave]
                if (-not (Test-ComponenteDetectado -Entrada $entrada)) { continue }
                $descriptor = New-FilaSidebar -Nombre $clave -TxKey $entrada.TxKey -Accion $entrada.Accion -Patrones $entrada.Patrones -EsGuiada
                [void]$Global:UI.PanelListaGuiadas.Children.Add($descriptor.Fila)
                $Global:UI.FilasSidebar[$clave] = $descriptor
            }
        }
    }
    catch {
        Write-Host "Error building the sidebar: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Get-InfoEquipo {
    <# Gathers the equipment-identification data (model, serial, BIOS, CPU, RAM, disk) via a
       handful of quick, read-only WMI/CIM queries. Pure data - no WPF/$Global:UI dependency at
       all - so it can run before the main window even exists (see the console pre-flight in the
       Main region), and later be rendered into the sidebar panel (Update-PanelInfoEquipo)
       without re-querying WMI. Pass -MostrarProgreso to print each step to the console as it
       completes (used only by the pre-flight; later calls run silently). #>
    param([switch]$MostrarProgreso)

    function Escribir-PasoDeteccion {
        param([int]$Paso, [int]$Total, [string]$Etiqueta, [string]$Valor)
        if (-not $MostrarProgreso) { return }
        $linea = "-" * 40
        Write-Host $linea -ForegroundColor DarkGray
        Write-Host (" [{0}/{1}] {2}" -f $Paso, $Total, $Etiqueta.ToUpper()) -ForegroundColor Cyan
        Write-Host $linea -ForegroundColor DarkGray
        Write-Host ("   -> {0}" -f $Valor) -ForegroundColor White
        Write-Host ""
    }

    $info = [ordered]@{
        Model         = $null
        Serial        = $null
        BiosVersion   = $null
        CpuNombre     = $null
        CpuNucleos    = $null
        CpuHilos      = $null
        RamTotalGB    = $null
        RamModulos    = @()
        DiskDetectado = $false
        DiskCapGB     = $null
        DiskMarca     = $null
        DiskModelo    = $null
        DiskSerie     = $null
        # Set if the try block below throws partway through - surfaced directly in the sidebar
        # panel (see Update-PanelInfoEquipo) so a failure is visible even when nobody is watching
        # the console pre-flight (e.g. running from the compiled launcher, where the console
        # window may not be visible/readable in practice).
        Error         = $null
    }

    try {
        $sistema  = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
        $producto = Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction SilentlyContinue
        $bios     = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue

        $info.Model = if ($sistema -and $sistema.Model) { $sistema.Model.Trim() } else { $null }
        Escribir-PasoDeteccion -Paso 1 -Total 6 -Etiqueta "Model" -Valor (if ($info.Model) { $info.Model } else { "N/A" })

        $serieEquipo = $null
        if ($bios -and $bios.SerialNumber -and $bios.SerialNumber -notmatch 'To Be Filled|Default string|System Serial|0000000') {
            $serieEquipo = $bios.SerialNumber.Trim()
        }
        elseif ($producto -and $producto.IdentifyingNumber) {
            $serieEquipo = $producto.IdentifyingNumber.Trim()
        }
        $info.Serial = $serieEquipo
        Escribir-PasoDeteccion -Paso 2 -Total 6 -Etiqueta "Serial" -Valor (if ($info.Serial) { $info.Serial } else { "N/A" })

        $versionBios = $null
        if ($bios) {
            if ($bios.SMBIOSBIOSVersion) {
                $versionBios = $bios.SMBIOSBIOSVersion.Trim()
            }
            elseif ($bios.BIOSVersion -and $bios.BIOSVersion.Count -gt 0) {
                $versionBios = ($bios.BIOSVersion -join " / ")
            }
            elseif ($bios.Version) {
                $versionBios = $bios.Version.Trim()
            }
        }
        $info.BiosVersion = $versionBios
        Escribir-PasoDeteccion -Paso 3 -Total 6 -Etiqueta "BIOS" -Valor (if ($info.BiosVersion) { $info.BiosVersion } else { "N/A" })

        $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cpu -and $cpu.Name) {
            $info.CpuNombre  = $cpu.Name.Trim()
            $info.CpuNucleos = $cpu.NumberOfCores
            $info.CpuHilos   = $cpu.NumberOfLogicalProcessors
        }
        Escribir-PasoDeteccion -Paso 4 -Total 6 -Etiqueta "CPU" -Valor (if ($info.CpuNombre) { $info.CpuNombre } else { "N/A" })

        $ramModulosRaw = @(Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue)
        if ($ramModulosRaw.Count -gt 0) {
            $info.RamTotalGB = [math]::Round((($ramModulosRaw | Measure-Object -Property Capacity -Sum).Sum / 1GB), 0)
            $indiceModulo = 0
            foreach ($m in $ramModulosRaw) {
                $indiceModulo++
                $info.RamModulos += [PSCustomObject]@{
                    Indice     = $indiceModulo
                    CapGB      = [math]::Round($m.Capacity / 1GB, 0)
                    Fabricante = if ($m.Manufacturer) { $m.Manufacturer.Trim() } else { "?" }
                    Serie      = if ($m.SerialNumber) { $m.SerialNumber.Trim() } else { $null }
                }
            }
        }
        $valorRam = if ($info.RamModulos.Count -gt 0) { "$($info.RamTotalGB) GB ($($info.RamModulos.Count) modules)" } else { "N/A" }
        Escribir-PasoDeteccion -Paso 5 -Total 6 -Etiqueta "RAM" -Valor $valorRam

        $discos = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)
        if ($discos.Count -gt 0) {
            $d = $discos[0]
            $info.DiskDetectado = $true
            $info.DiskCapGB = if ($d.Size) { [math]::Round($d.Size / 1GB, 0) } else { 0 }
            $info.DiskMarca = if ($d.Manufacturer -and $d.Manufacturer -notmatch 'Standard disk drives') {
                $d.Manufacturer.Trim()
            } elseif ($d.Model) {
                ($d.Model.Trim() -split '\s+')[0]
            } else { "?" }
            $info.DiskModelo = if ($d.Model) { $d.Model.Trim() } else { $null }
            $info.DiskSerie  = if ($d.SerialNumber) { $d.SerialNumber.Trim() } else { $null }
        }
        $valorDisk = if ($info.DiskDetectado) { "$($info.DiskCapGB) GB - $($info.DiskMarca)" } else { "N/A" }
        Escribir-PasoDeteccion -Paso 6 -Total 6 -Etiqueta "Disk" -Valor $valorDisk
    }
    catch {
        $info.Error = $_.Exception.Message
        Write-Host "Error gathering equipment info: $($_.Exception.Message)" -ForegroundColor Red
    }

    return $info
}

function Update-PanelInfoEquipo {
    <# Populates the left equipment-info cards (model, serial, BIOS, CPU, RAM, disk) with a
       quick, read-only WMI query - queried directly, live, every time this is called (window
       build, after Phase 1, on language switch), instead of reusing a value cached earlier by
       Get-InfoEquipo. An older version of this tool did it this way and it was reliable; a
       cached/pre-gathered version added later in this same tool turned out not to be, so this
       reverts to the proven approach for the actual panel rendering. Get-InfoEquipo is still
       used for the console pre-flight preview and the initial NumberUnit default - just no
       longer as the panel's data source. #>
    try {
        if (-not $Global:UI) { return }
        $naTexto = Tx "Info.NotAvailable"

        $sistema  = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
        $producto = Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction SilentlyContinue
        $bios     = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue
        $cpu      = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        $ramModulos = @(Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue)
        $discos     = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)

        $Global:UI.TxtInfoModel.Text = if ($sistema -and $sistema.Model) { $sistema.Model.Trim() } else { $naTexto }

        $serieEquipo = $null
        if ($bios -and $bios.SerialNumber -and $bios.SerialNumber -notmatch 'To Be Filled|Default string|System Serial|0000000') {
            $serieEquipo = $bios.SerialNumber.Trim()
        }
        elseif ($producto -and $producto.IdentifyingNumber) {
            $serieEquipo = $producto.IdentifyingNumber.Trim()
        }
        $Global:UI.TxtInfoSerial.Text = if ($serieEquipo) { $serieEquipo } else { $naTexto }

        $versionBios = $null
        if ($bios) {
            if ($bios.SMBIOSBIOSVersion) {
                $versionBios = $bios.SMBIOSBIOSVersion.Trim()
            }
            elseif ($bios.BIOSVersion -and $bios.BIOSVersion.Count -gt 0) {
                $versionBios = ($bios.BIOSVersion -join " / ")
            }
            elseif ($bios.Version) {
                $versionBios = $bios.Version.Trim()
            }
        }
        $Global:UI.TxtInfoBIOS.Text = if ($versionBios) { $versionBios } else { $naTexto }

        $Global:UI.TxtInfoCPU.Text = if ($cpu -and $cpu.Name) {
            "{0} ({1}C/{2}T)" -f $cpu.Name.Trim(), $cpu.NumberOfCores, $cpu.NumberOfLogicalProcessors
        } else { $naTexto }

        if ($Global:UI.PanelInfoRAMModulos) { $Global:UI.PanelInfoRAMModulos.Children.Clear() }

        if ($ramModulos.Count -gt 0) {
            $capTotalGB = [math]::Round((($ramModulos | Measure-Object -Property Capacity -Sum).Sum / 1GB), 0)
            $Global:UI.TxtInfoRAM.Text = "{0} GB ({1} {2})" -f $capTotalGB, $ramModulos.Count, (Tx "Info.Modules")

            if ($Global:UI.PanelInfoRAMModulos) {
                $indiceModulo = 0
                foreach ($m in $ramModulos) {
                    $indiceModulo++
                    $capGB = [math]::Round($m.Capacity / 1GB, 0)
                    $fabricante = if ($m.Manufacturer) { $m.Manufacturer.Trim() } else { "?" }
                    $serieModulo = if ($m.SerialNumber) { $m.SerialNumber.Trim() } else { $naTexto }
                    $filaModulo = New-Object System.Windows.Controls.TextBlock
                    $filaModulo.Text = "{0} {1}: {2} GB {3} - SN: {4}" -f (Tx "Info.Module"), $indiceModulo, $capGB, $fabricante, $serieModulo
                    $filaModulo.Foreground = [System.Windows.Media.Brushes]::Gainsboro
                    $filaModulo.FontSize = 11
                    $filaModulo.TextWrapping = 'Wrap'
                    $filaModulo.Margin = New-Object System.Windows.Thickness(0, 2, 0, 0)
                    [void]$Global:UI.PanelInfoRAMModulos.Children.Add($filaModulo)
                }
            }
        }
        else {
            $Global:UI.TxtInfoRAM.Text = $naTexto
        }

        if ($discos.Count -gt 0) {
            $d = $discos[0]
            $capGB = if ($d.Size) { [math]::Round($d.Size / 1GB, 0) } else { 0 }
            $marcaDisco = if ($d.Manufacturer -and $d.Manufacturer -notmatch 'Standard disk drives') {
                $d.Manufacturer.Trim()
            } elseif ($d.Model) {
                ($d.Model.Trim() -split '\s+')[0]
            } else { "?" }
            $Global:UI.TxtInfoDisk.Text = "$capGB GB - $marcaDisco"
            $Global:UI.TxtInfoDiskDetalle.Text = if ($d.Model) { $d.Model.Trim() } else { "" }
            $serieDisco = if ($d.SerialNumber) { $d.SerialNumber.Trim() } else { $naTexto }
            $Global:UI.TxtInfoDiskSerial.Text = "$(Tx 'Info.Serial'): $serieDisco"
        }
        else {
            $Global:UI.TxtInfoDisk.Text = $naTexto
            $Global:UI.TxtInfoDiskDetalle.Text = ""
            $Global:UI.TxtInfoDiskSerial.Text = ""
        }

        # Keep the report's "unit" identifier in sync with whatever serial this direct query just
        # found, in case the console pre-flight's own gather (Get-InfoEquipo, Main region) came up
        # short for any reason - this is the panel's proven-reliable query, so it wins if the two
        # ever disagree.
        if ($serieEquipo) { $Global:DatosExportacion.NumberUnit = $serieEquipo }
    }
    catch {
        Write-Host "Error updating the equipment info panel: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Update-BarraEstado {
    try {
        if (-not $Global:UI) { return }
        $so = (Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue).Caption
        $Global:UI.LblEquipo.Text  = "$(Tx 'Status.Computer'): $env:COMPUTERNAME"
        $Global:UI.LblUsuario.Text = "$(Tx 'Status.User'): $env:USERNAME"
        $Global:UI.LblOS.Text      = "$(Tx 'Status.OS'): $so"
        $Global:UI.LblFecha.Text   = "$(Tx 'Status.Date'): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

        $total = $Global:Resultados.Count
        $pass  = ($Global:Resultados | Where-Object { $_.Estado -eq 'PASS' }).Count
        $fail  = ($Global:Resultados | Where-Object { $_.Estado -eq 'FAIL' }).Count
        $Global:UI.LblContadores.Text = "$(Tx 'Status.Tests'): $total   PASS: $pass   FAIL: $fail"
    }
    catch {
        Write-Host "Error updating the status bar: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Update-IdiomaUI {
    <# Refresca todo el texto estatico de la ventana principal segun $Global:Idioma. #>
    try {
        if (-not $Global:UI) { return }
        $Global:UI.Ventana.Title = Tx "App.Title"
        $Global:UI.TxtBtnIniciar.Text = Tx "Config.Start"
        $Global:UI.TxtBtnGuiadas.Text = Tx "Diag.Guided"
        $Global:UI.TxtBtnGuardar.Text = Tx "Diag.Save"
        $Global:UI.TxtBtnCSV.Text = Tx "Diag.CSV"
        $Global:UI.TxtBtnExcel.Text = Tx "Diag.Excel"
        $Global:UI.TxtBtnReiniciar.Text = Tx "Diag.Restart"
        $Global:UI.TxtBtnCerrar.Text = Tx "Diag.Close"
        $Global:UI.ColComponente.Header = Tx "Col.Component"
        $Global:UI.ColEstado.Header = Tx "Col.Status"
        $Global:UI.ColDetalle.Header = Tx "Col.Detail"
        $Global:UI.LblIdioma.Text = Tx "Lang.Label"
        $Global:UI.LblStatTotal.Text = Tx "Dash.Total"
        $Global:UI.LblStatPass.Text = Tx "Dash.Pass"
        $Global:UI.LblStatFail.Text = Tx "Dash.Fail"
        $Global:UI.LblStatWarning.Text = Tx "Dash.Warning"
        $Global:UI.BtnFiltroAll.Content = Tx "Filter.All"
        $Global:UI.BtnFiltroPass.Content = Tx "Filter.Pass"
        $Global:UI.BtnFiltroFail.Content = Tx "Filter.Fail"
        $Global:UI.BtnFiltroWarning.Content = Tx "Filter.Warning"
        $Global:UI.BtnFiltroInfo.Content = Tx "Filter.Info"
        $Global:UI.LblSidebarAuto.Text = Tx "Sidebar.AutoTitle"
        $Global:UI.LblSidebarGuiadas.Text = Tx "Sidebar.GuidedTitle"
        $Global:UI.LblInfoPanelTitulo.Text = Tx "Info.PanelTitle"
        $Global:UI.LblInfoModelLabel.Text = Tx "Info.Model"
        $Global:UI.LblInfoSerialLabel.Text = Tx "Info.Serial"
        $Global:UI.LblInfoBIOSLabel.Text = Tx "Info.BIOS"
        $Global:UI.LblInfoCPULabel.Text = Tx "Info.CPU"
        $Global:UI.LblInfoRAMLabel.Text = Tx "Info.RAM"
        $Global:UI.LblInfoDiskLabel.Text = Tx "Info.Disk"
        $Global:UI.TxtBtnScreenTest.Text = Tx "Side.ScreenTest"
        $Global:UI.TxtBtnTabCal.Text = Tx "Info.CalibrateTouch"
        $Global:UI.TxtBtnSysprep.Text = Tx "Info.Sysprep"

        if ($Global:UI.FilasSidebar) {
            foreach ($descriptor in $Global:UI.FilasSidebar.Values) {
                $descriptor.Texto.Text = Tx $descriptor.TxKey
            }
        }

        if ($Global:Resultados.Count -eq 0) {
            $Global:UI.LblEstadoActual.Text = Tx "Diag.Waiting"
        }

        Update-BarraEstado
    }
    catch {
        Write-Host "Error updating UI language: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function New-TextoReporte {
    try {
        $so = (Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue).Caption
        $sb = New-Object System.Text.StringBuilder
        [void]$sb.AppendLine("========================================")
        [void]$sb.AppendLine(" HARDWARE DIAGNOSTICS REPORT")
        [void]$sb.AppendLine(" Tool version: $Global:VersionHerramienta")
        [void]$sb.AppendLine("========================================")
        [void]$sb.AppendLine("Computer:  $env:COMPUTERNAME")
        [void]$sb.AppendLine("User:      $env:USERNAME")
        [void]$sb.AppendLine("Windows:   $so")
        [void]$sb.AppendLine("Date:      $(Get-Date -Format 'yyyy-MM-dd')")
        [void]$sb.AppendLine("Time:      $(Get-Date -Format 'HH:mm:ss')")
        [void]$sb.AppendLine("========================================")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("RESULTS")
        [void]$sb.AppendLine("----------------------------------------")
        foreach ($r in $Global:Resultados) {
            [void]$sb.AppendLine("[$($r.Estado)] $($r.Componente) - $($r.Detalle)")
        }
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("========================================")
        [void]$sb.AppendLine("SUMMARY")
        [void]$sb.AppendLine("----------------------------------------")
        [void]$sb.AppendLine("Total tests: $($Global:Resultados.Count)")
        [void]$sb.AppendLine("PASS:    $(($Global:Resultados | Where-Object { $_.Estado -eq 'PASS' }).Count)")
        [void]$sb.AppendLine("FAIL:    $(($Global:Resultados | Where-Object { $_.Estado -eq 'FAIL' }).Count)")
        [void]$sb.AppendLine("WARNING: $(($Global:Resultados | Where-Object { $_.Estado -eq 'WARNING' }).Count)")
        [void]$sb.AppendLine("INFO:    $(($Global:Resultados | Where-Object { $_.Estado -eq 'INFO' }).Count)")
        [void]$sb.AppendLine("========================================")
        return $sb.ToString()
    }
    catch {
        return "Error generating the report content: $($_.Exception.Message)"
    }
}

function Get-IdentificadorReporte {
    <# Filename-safe identifier for report files - the equipment's serial number (auto-detected,
       see Get-InfoEquipo/NumberUnit) when available, falling back to the computer name if no
       serial was detected. Strips characters that aren't valid in a Windows filename, just in
       case a serial number ever contains one. #>
    if ($Global:DatosExportacion.NumberUnit) {
        return ($Global:DatosExportacion.NumberUnit -replace '[\\/:*?"<>|]', '-')
    }
    return $env:COMPUTERNAME
}

function Save-ReporteTexto {
    try {
        if (-not (Test-Path -Path $Global:RutaReportes)) { New-Item -Path $Global:RutaReportes -ItemType Directory -Force | Out-Null }
        $nombreArchivo = "{0}_{1}.txt" -f (Get-IdentificadorReporte), (Get-Date -Format "yyyy-MM-dd_HH-mm")
        $rutaCompleta = Join-Path -Path $Global:RutaReportes -ChildPath $nombreArchivo
        Set-Content -Path $rutaCompleta -Value (New-TextoReporte) -Encoding UTF8
        Show-DialogoInfo (Tx "Dialog.ReportSaved" $rutaCompleta) (Tx "Dialog.ReportSavedTitle")
        return $rutaCompleta
    }
    catch {
        Show-DialogoInfo (Tx "Dialog.ReportError" $_.Exception.Message) (Tx "Dialog.ErrorTitle")
        return $null
    }
}

function Export-ReporteCSV {
    try {
        if (-not (Test-Path -Path $Global:RutaReportes)) { New-Item -Path $Global:RutaReportes -ItemType Directory -Force | Out-Null }
        $nombreArchivo = "{0}_{1}.csv" -f (Get-IdentificadorReporte), (Get-Date -Format "yyyy-MM-dd_HH-mm")
        $rutaCompleta = Join-Path -Path $Global:RutaReportes -ChildPath $nombreArchivo
        $Global:Resultados | Export-Csv -Path $rutaCompleta -NoTypeInformation -Encoding UTF8 -Delimiter ";"
        Show-DialogoInfo (Tx "Dialog.CSVSaved" $rutaCompleta) (Tx "Dialog.CSVSavedTitle")
        return $rutaCompleta
    }
    catch {
        Show-DialogoInfo (Tx "Dialog.CSVError" $_.Exception.Message) (Tx "Dialog.ErrorTitle")
        return $null
    }
}

function Export-FilaExcel {
    param([switch]$Silencioso)
    try {
        if (-not (Test-Path -Path $Global:RutaReportes)) { New-Item -Path $Global:RutaReportes -ItemType Directory -Force | Out-Null }

        $encabezados = @(
            "Status", "Date", "Order", "Number Unit", "Serial Model", "Size disk", "serial Disk",
            "RAM 1", "RAM 2", "Battery 1", "Battery 2", "Dis updates", "wifi", "windows", "bt",
            "sound", "camera", "dvd", "usb", "batery", "keyboard", "drivers", "4g", "Extensions",
            "Bios & EC", "Comments"
        )

        $estadoGeneral = Get-EstadoComponente -Patron "*"
        $estadoDrivers = Get-PeorEstado -Estados @((Get-EstadoComponente -Patron "Drivers"), (Get-EstadoComponente -Patron "Driver Versions"))
        $estadoExtensiones = Get-EstadoComponente -Patron "Port*"
        $estadoDVD = Get-PeorEstado -Estados @((Get-EstadoComponente -Patron "Optical Drive"), (Get-EstadoComponente -Patron "DVD"))

        $comentarioAuto = ($Global:Resultados | Where-Object { $_.Estado -in @('FAIL', 'WARNING') } |
            ForEach-Object { "[$($_.Estado)] $($_.Componente): $($_.Detalle)" }) -join " | "
        $comentarioFinal = if ($Global:DatosExportacion.Comentario) { "$($Global:DatosExportacion.Comentario) -- $comentarioAuto" } else { $comentarioAuto }

        $valores = @(
            $estadoGeneral,
            (Get-Date -Format "yyyy-MM-dd"),
            $Global:DatosExportacion.Order,
            $Global:DatosExportacion.NumberUnit,
            $Global:DatosExportacion.SerialModel,
            $Global:DatosExportacion.SizeDisk,
            $Global:DatosExportacion.SerialDisk,
            $Global:DatosExportacion.RAM1,
            $Global:DatosExportacion.RAM2,
            $Global:DatosExportacion.Battery1,
            $Global:DatosExportacion.Battery2,
            (Get-EstadoComponente -Patron "Windows Update"),
            (Get-EstadoComponente -Patron "WiFi"),
            (Get-EstadoComponente -Patron "Windows Activation"),
            (Get-EstadoComponente -Patron "Bluetooth"),
            (Get-EstadoComponente -Patron "Audio"),
            (Get-EstadoComponente -Patron "Camera"),
            $estadoDVD,
            (Get-EstadoComponente -Patron "USB"),
            (Get-EstadoComponente -Patron "Battery"),
            (Get-EstadoComponente -Patron "Keyboard"),
            $estadoDrivers,
            (Get-EstadoComponente -Patron "WWAN"),
            $estadoExtensiones,
            (Get-EstadoComponente -Patron "BIOS"),
            $comentarioFinal
        )

        $valoresLimpios = $valores | ForEach-Object { if ($null -eq $_) { "" } else { ($_ -replace "[\t\r\n]", " ") } }

        if (-not (Test-Path -Path $Global:RutaExportacionExcel)) {
            Set-Content -Path $Global:RutaExportacionExcel -Value ($encabezados -join "`t") -Encoding UTF8
        }
        Add-Content -Path $Global:RutaExportacionExcel -Value ($valoresLimpios -join "`t") -Encoding UTF8
        $Global:ExportacionRealizada = $true

        if (-not $Silencioso) { Show-DialogoInfo (Tx "Dialog.ExcelSaved" $Global:RutaExportacionExcel) (Tx "Dialog.ExcelSavedTitle") }
        return $Global:RutaExportacionExcel
    }
    catch {
        if (-not $Silencioso) { Show-DialogoInfo (Tx "Dialog.ExcelError" $_.Exception.Message) (Tx "Dialog.ErrorTitle") }
        return $null
    }
}

function New-VentanaPrincipalXaml {
    $xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Hardware Diagnostics" Height="750" Width="1150" MinHeight="600" MinWidth="900"
        WindowStartupLocation="CenterScreen" Background="#181818" FontFamily="Segoe UI">
    <Window.Resources>
        <Style x:Key="Etiqueta" TargetType="TextBlock">
            <Setter Property="Foreground" Value="#B0B0B0"/>
            <Setter Property="FontSize" Value="12"/>
            <Setter Property="Margin" Value="0,0,0,4"/>
        </Style>
        <Style x:Key="Titulo" TargetType="TextBlock">
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="FontSize" Value="19"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
        </Style>
        <Style TargetType="TextBox">
            <Setter Property="Background" Value="#2B2B2B"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="Padding" Value="8"/>
            <Setter Property="BorderBrush" Value="#3A3A3A"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="CaretBrush" Value="White"/>
        </Style>
        <Style TargetType="PasswordBox">
            <Setter Property="Background" Value="#2B2B2B"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="Padding" Value="8"/>
            <Setter Property="BorderBrush" Value="#3A3A3A"/>
            <Setter Property="BorderThickness" Value="1"/>
        </Style>
        <Style TargetType="CheckBox">
            <Setter Property="Foreground" Value="#E0E0E0"/>
        </Style>
        <Style TargetType="TabItem">
            <Setter Property="Background" Value="Transparent"/>
            <Setter Property="Foreground" Value="#909090"/>
            <Setter Property="Padding" Value="18,10"/>
            <Setter Property="FontSize" Value="13"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TabItem">
                        <Border Name="bd" Background="{TemplateBinding Background}" BorderThickness="0,0,0,3" BorderBrush="Transparent" Padding="{TemplateBinding Padding}">
                            <ContentPresenter ContentSource="Header" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsSelected" Value="True">
                                <Setter TargetName="bd" Property="BorderBrush" Value="#0A84FF"/>
                                <Setter Property="Foreground" Value="White"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        <Style TargetType="TabControl">
            <Setter Property="Background" Value="Transparent"/>
            <Setter Property="BorderThickness" Value="0"/>
        </Style>
        <Style TargetType="ProgressBar">
            <Setter Property="Background" Value="#2B2B2B"/>
            <Setter Property="Foreground" Value="#0A84FF"/>
            <Setter Property="BorderThickness" Value="0"/>
            <Setter Property="Height" Value="10"/>
        </Style>
        <Style TargetType="ListView">
            <Setter Property="Background" Value="#202020"/>
            <Setter Property="Foreground" Value="#E0E0E0"/>
            <Setter Property="BorderThickness" Value="0"/>
        </Style>
        <Style TargetType="GridViewColumnHeader">
            <Setter Property="Background" Value="#2B2B2B"/>
            <Setter Property="Foreground" Value="#B0B0B0"/>
            <Setter Property="Padding" Value="8,6"/>
        </Style>
    </Window.Resources>
    <DockPanel LastChildFill="True">
        <Border DockPanel.Dock="Top" Background="#101010" Padding="20,14">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                <StackPanel Grid.Column="0" Orientation="Horizontal">
                    <TextBlock Text="Hardware Diagnostics" Style="{StaticResource Titulo}"/>
                    <TextBlock Name="lblVersion" Text="" Foreground="#707070" FontSize="12" Margin="10,7,0,0"/>
                </StackPanel>
                <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Center">
                    <TextBlock Name="lblIdioma" Text="Language" Foreground="#707070" FontSize="12" Margin="0,0,8,0" VerticalAlignment="Center"/>
                    <Button Name="btnIdiomaEN" Content="EN" Width="42" Margin="0,0,4,0"/>
                    <Button Name="btnIdiomaES" Content="ES" Width="42"/>
                </StackPanel>
            </Grid>
        </Border>
        <Border DockPanel.Dock="Bottom" Background="#101010" Padding="16,8">
            <StackPanel Orientation="Horizontal">
                <TextBlock Name="lblEquipo" Text="Computer: -" Foreground="#909090" Margin="0,0,20,0"/>
                <TextBlock Name="lblUsuario" Text="User: -" Foreground="#909090" Margin="0,0,20,0"/>
                <TextBlock Name="lblOS" Text="Windows: -" Foreground="#909090" Margin="0,0,20,0"/>
                <TextBlock Name="lblFecha" Text="Date: -" Foreground="#909090" Margin="0,0,20,0"/>
                <TextBlock Name="lblContadores" Text="Tests: 0" Foreground="#909090"/>
            </StackPanel>
        </Border>
        <DockPanel Margin="16">
                    <StackPanel DockPanel.Dock="Top" Margin="0,0,0,12">
                        <TextBlock Name="lblEstadoActual" Text="Press Start Automatic Diagnostics to begin." Foreground="#B0B0B0" Margin="0,0,0,6"/>
                        <Grid>
                            <ProgressBar Name="barraProgreso" Minimum="0" Maximum="1" Value="0" Height="18"/>
                            <TextBlock Name="lblProgresoPorcentaje" Text="" Foreground="White" FontSize="10" FontWeight="SemiBold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Grid>
                    </StackPanel>
                    <StackPanel DockPanel.Dock="Bottom" Orientation="Horizontal" Margin="0,12,0,0" Name="panelBotonesReporte">
                        <Button Name="btnIniciar" Margin="0,0,8,0">
                            <StackPanel Orientation="Horizontal">
                                <TextBlock Text="&#xE768;" FontFamily="Segoe MDL2 Assets" FontSize="14" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                <TextBlock Name="txtBtnIniciar" Text="Start Automatic Diagnostics" VerticalAlignment="Center"/>
                            </StackPanel>
                        </Button>
                        <Button Name="btnGuiadas" Margin="0,0,8,0">
                            <StackPanel Orientation="Horizontal">
                                <TextBlock Text="&#xE73E;" FontFamily="Segoe MDL2 Assets" FontSize="14" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                <TextBlock Name="txtBtnGuiadas" Text="Guided Tests" VerticalAlignment="Center"/>
                            </StackPanel>
                        </Button>
                        <Button Name="btnGuardar" Margin="0,0,8,0">
                            <StackPanel Orientation="Horizontal">
                                <TextBlock Text="&#xE74E;" FontFamily="Segoe MDL2 Assets" FontSize="14" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                <TextBlock Name="txtBtnGuardar" Text="Save Report" VerticalAlignment="Center"/>
                            </StackPanel>
                        </Button>
                        <Button Name="btnCSV" Margin="0,0,8,0">
                            <StackPanel Orientation="Horizontal">
                                <TextBlock Text="&#xE896;" FontFamily="Segoe MDL2 Assets" FontSize="14" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                <TextBlock Name="txtBtnCSV" Text="Export CSV" VerticalAlignment="Center"/>
                            </StackPanel>
                        </Button>
                        <Button Name="btnExcel" Margin="0,0,8,0">
                            <StackPanel Orientation="Horizontal">
                                <TextBlock Text="&#xE896;" FontFamily="Segoe MDL2 Assets" FontSize="14" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                <TextBlock Name="txtBtnExcel" Text="Export Excel" VerticalAlignment="Center"/>
                            </StackPanel>
                        </Button>
                        <Button Name="btnReiniciar" Margin="0,0,8,0">
                            <StackPanel Orientation="Horizontal">
                                <TextBlock Text="&#xE72C;" FontFamily="Segoe MDL2 Assets" FontSize="14" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                <TextBlock Name="txtBtnReiniciar" Text="Finish &amp; Restart" VerticalAlignment="Center"/>
                            </StackPanel>
                        </Button>
                        <Button Name="btnCerrar">
                            <StackPanel Orientation="Horizontal">
                                <TextBlock Text="&#xE711;" FontFamily="Segoe MDL2 Assets" FontSize="14" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                <TextBlock Name="txtBtnCerrar" Text="Close" VerticalAlignment="Center"/>
                            </StackPanel>
                        </Button>
                    </StackPanel>
                    <Grid>
                        <Grid.ColumnDefinitions>
                            <ColumnDefinition Width="250"/>
                            <ColumnDefinition Width="14"/>
                            <ColumnDefinition Width="*"/>
                        </Grid.ColumnDefinitions>
                        <Border Grid.Column="0" Background="#161616" CornerRadius="8" Padding="0,12">
                            <ScrollViewer VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
                                <StackPanel Margin="12,0,12,0">
                                    <TextBlock Name="lblInfoPanelTitulo" Text="EQUIPMENT INFO" Foreground="#707070" FontSize="10" FontWeight="SemiBold" Margin="2,0,0,10"/>

                                    <Border Background="#202020" CornerRadius="8" Padding="12,10" Margin="0,0,0,8">
                                        <StackPanel>
                                            <TextBlock Name="lblInfoModelLabel" Text="Model" Foreground="#808080" FontSize="10"/>
                                            <TextBlock Name="txtInfoModel" Text="—" Foreground="White" FontSize="13" FontWeight="SemiBold" TextWrapping="Wrap" Margin="0,1,0,8"/>
                                            <TextBlock Name="lblInfoSerialLabel" Text="Serial" Foreground="#808080" FontSize="10"/>
                                            <TextBlock Name="txtInfoSerial" Text="—" Foreground="White" FontSize="13" FontWeight="SemiBold" TextWrapping="Wrap" Margin="0,1,0,0"/>
                                        </StackPanel>
                                    </Border>

                                    <Border Background="#202020" CornerRadius="8" Padding="12,10" Margin="0,0,0,8">
                                        <StackPanel>
                                            <TextBlock Name="lblInfoBIOSLabel" Text="BIOS" Foreground="#808080" FontSize="10"/>
                                            <TextBlock Name="txtInfoBIOS" Text="—" Foreground="White" FontSize="13" FontWeight="SemiBold" TextWrapping="Wrap" Margin="0,1,0,0"/>
                                        </StackPanel>
                                    </Border>

                                    <Border Background="#202020" CornerRadius="8" Padding="12,10" Margin="0,0,0,8">
                                        <StackPanel>
                                            <TextBlock Name="lblInfoCPULabel" Text="CPU" Foreground="#808080" FontSize="10"/>
                                            <TextBlock Name="txtInfoCPU" Text="—" Foreground="White" FontSize="13" FontWeight="SemiBold" TextWrapping="Wrap" Margin="0,1,0,0"/>
                                        </StackPanel>
                                    </Border>

                                    <Border Background="#202020" CornerRadius="8" Padding="12,10" Margin="0,0,0,8">
                                        <StackPanel>
                                            <TextBlock Name="lblInfoRAMLabel" Text="RAM" Foreground="#808080" FontSize="10"/>
                                            <TextBlock Name="txtInfoRAM" Text="—" Foreground="White" FontSize="13" FontWeight="SemiBold" TextWrapping="Wrap" Margin="0,1,0,2"/>
                                            <StackPanel Name="panelInfoRAMModulos"/>
                                        </StackPanel>
                                    </Border>

                                    <Border Background="#202020" CornerRadius="8" Padding="12,10" Margin="0,0,0,8">
                                        <StackPanel>
                                            <TextBlock Name="lblInfoDiskLabel" Text="Disk" Foreground="#808080" FontSize="10"/>
                                            <TextBlock Name="txtInfoDisk" Text="—" Foreground="White" FontSize="13" FontWeight="SemiBold" TextWrapping="Wrap" Margin="0,1,0,2"/>
                                            <TextBlock Name="txtInfoDiskDetalle" Text="" Foreground="#909090" FontSize="11" TextWrapping="Wrap" Margin="0,0,0,2"/>
                                            <TextBlock Name="txtInfoDiskSerial" Text="" Foreground="#909090" FontSize="11" TextWrapping="Wrap"/>
                                        </StackPanel>
                                    </Border>

                                    <Button Name="btnScreenTest" Margin="0,4,0,0">
                                        <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
                                            <TextBlock Text="&#xE7F4;" FontFamily="Segoe MDL2 Assets" FontSize="13" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                            <TextBlock Name="txtBtnScreenTest" Text="Screen Test" VerticalAlignment="Center" FontSize="11"/>
                                        </StackPanel>
                                    </Button>
                                    <Button Name="btnTabCal" Margin="0,6,0,0">
                                        <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
                                            <TextBlock Text="&#xE713;" FontFamily="Segoe MDL2 Assets" FontSize="13" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                            <TextBlock Name="txtBtnTabCal" Text="Calibrate Touch Screen" VerticalAlignment="Center" FontSize="11"/>
                                        </StackPanel>
                                    </Button>
                                    <Button Name="btnSysprep" Margin="0,6,0,0">
                                        <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
                                            <TextBlock Text="&#xE777;" FontFamily="Segoe MDL2 Assets" FontSize="13" Margin="0,0,6,0" VerticalAlignment="Center"/>
                                            <TextBlock Name="txtBtnSysprep" Text="Sysprep" VerticalAlignment="Center" FontSize="11"/>
                                        </StackPanel>
                                    </Button>
                                </StackPanel>
                            </ScrollViewer>
                        </Border>
                        <DockPanel Grid.Column="2">
                            <ScrollViewer DockPanel.Dock="Top" MaxHeight="300" Margin="0,0,0,12" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
                                <StackPanel>
                                    <TextBlock Name="lblSidebarAuto" Text="AUTOMATIC TESTS" Foreground="#707070" FontSize="10" FontWeight="SemiBold" Margin="2,0,0,6"/>
                                    <WrapPanel Name="panelListaAutomaticas" Margin="0,0,0,10"/>
                                    <TextBlock Name="lblSidebarGuiadas" Text="GUIDED TESTS" Foreground="#707070" FontSize="10" FontWeight="SemiBold" Margin="2,0,0,6"/>
                                    <WrapPanel Name="panelListaGuiadas"/>
                                </StackPanel>
                            </ScrollViewer>
                            <StackPanel DockPanel.Dock="Top" Margin="0,0,0,14">
                                <Grid>
                                    <Grid.ColumnDefinitions>
                                        <ColumnDefinition Width="*"/>
                                        <ColumnDefinition Width="*"/>
                                        <ColumnDefinition Width="*"/>
                                        <ColumnDefinition Width="*"/>
                                    </Grid.ColumnDefinitions>
                                    <Border Grid.Column="0" Background="#202020" CornerRadius="8" Padding="14,10" Margin="0,0,6,0" BorderBrush="#0A84FF" BorderThickness="0,0,0,3">
                                        <StackPanel>
                                            <TextBlock Name="txtStatTotal" Text="0" Foreground="White" FontSize="26" FontWeight="Bold"/>
                                            <TextBlock Name="lblStatTotal" Text="TOTAL TESTS" Foreground="#909090" FontSize="10" Margin="0,2,0,0"/>
                                        </StackPanel>
                                    </Border>
                                    <Border Grid.Column="1" Background="#202020" CornerRadius="8" Padding="14,10" Margin="6,0,6,0" BorderBrush="#2E7D32" BorderThickness="0,0,0,3">
                                        <StackPanel>
                                            <TextBlock Name="txtStatPass" Text="0" Foreground="#66BB6A" FontSize="26" FontWeight="Bold"/>
                                            <TextBlock Name="lblStatPass" Text="PASSED" Foreground="#909090" FontSize="10" Margin="0,2,0,0"/>
                                        </StackPanel>
                                    </Border>
                                    <Border Grid.Column="2" Background="#202020" CornerRadius="8" Padding="14,10" Margin="6,0,6,0" BorderBrush="#C62828" BorderThickness="0,0,0,3">
                                        <StackPanel>
                                            <TextBlock Name="txtStatFail" Text="0" Foreground="#EF5350" FontSize="26" FontWeight="Bold"/>
                                            <TextBlock Name="lblStatFail" Text="FAILED" Foreground="#909090" FontSize="10" Margin="0,2,0,0"/>
                                        </StackPanel>
                                    </Border>
                                    <Border Grid.Column="3" Background="#202020" CornerRadius="8" Padding="14,10" Margin="6,0,0,0" BorderBrush="#EF6C00" BorderThickness="0,0,0,3">
                                        <StackPanel>
                                            <TextBlock Name="txtStatWarning" Text="0" Foreground="#FFA726" FontSize="26" FontWeight="Bold"/>
                                            <TextBlock Name="lblStatWarning" Text="WARNINGS" Foreground="#909090" FontSize="10" Margin="0,2,0,0"/>
                                        </StackPanel>
                                    </Border>
                                </Grid>
                                <StackPanel Orientation="Horizontal" Margin="0,10,0,0">
                                    <Button Name="btnFiltroAll" Content="All" Margin="0,0,6,0" FontSize="11"/>
                                    <Button Name="btnFiltroPass" Content="Passed" Margin="0,0,6,0" FontSize="11"/>
                                    <Button Name="btnFiltroFail" Content="Failed" Margin="0,0,6,0" FontSize="11"/>
                                    <Button Name="btnFiltroWarning" Content="Warnings" Margin="0,0,6,0" FontSize="11"/>
                                    <Button Name="btnFiltroInfo" Content="Info" FontSize="11"/>
                                </StackPanel>
                            </StackPanel>
                            <ListView Name="listViewResultados" AlternationCount="2">
                                <ListView.ItemContainerStyle>
                                    <Style TargetType="ListViewItem">
                                        <Setter Property="Padding" Value="6,4"/>
                                        <Style.Triggers>
                                            <Trigger Property="ItemsControl.AlternationIndex" Value="1">
                                                <Setter Property="Background" Value="#252525"/>
                                            </Trigger>
                                            <DataTrigger Binding="{Binding Estado}" Value="PASS">
                                                <Setter Property="Foreground" Value="#66BB6A"/>
                                            </DataTrigger>
                                            <DataTrigger Binding="{Binding Estado}" Value="FAIL">
                                                <Setter Property="Foreground" Value="#EF5350"/>
                                            </DataTrigger>
                                            <DataTrigger Binding="{Binding Estado}" Value="WARNING">
                                                <Setter Property="Foreground" Value="#FFA726"/>
                                            </DataTrigger>
                                            <DataTrigger Binding="{Binding Estado}" Value="INFO">
                                                <Setter Property="Foreground" Value="#42A5F5"/>
                                            </DataTrigger>
                                        </Style.Triggers>
                                    </Style>
                                </ListView.ItemContainerStyle>
                                <ListView.View>
                                    <GridView>
                                        <GridViewColumn Header="Component" Width="220" DisplayMemberBinding="{Binding Componente}" x:Name="colComponente"/>
                                        <GridViewColumn Header="Status" Width="100" x:Name="colEstado">
                                            <GridViewColumn.CellTemplate>
                                                <DataTemplate>
                                                    <Border CornerRadius="10" Padding="10,3" HorizontalAlignment="Left">
                                                        <Border.Style>
                                                            <Style TargetType="Border">
                                                                <Setter Property="Background" Value="#555555"/>
                                                                <Style.Triggers>
                                                                    <DataTrigger Binding="{Binding Estado}" Value="PASS">
                                                                        <Setter Property="Background" Value="#2E7D32"/>
                                                                    </DataTrigger>
                                                                    <DataTrigger Binding="{Binding Estado}" Value="FAIL">
                                                                        <Setter Property="Background" Value="#C62828"/>
                                                                    </DataTrigger>
                                                                    <DataTrigger Binding="{Binding Estado}" Value="WARNING">
                                                                        <Setter Property="Background" Value="#EF6C00"/>
                                                                    </DataTrigger>
                                                                    <DataTrigger Binding="{Binding Estado}" Value="INFO">
                                                                        <Setter Property="Background" Value="#1565C0"/>
                                                                    </DataTrigger>
                                                                </Style.Triggers>
                                                            </Style>
                                                        </Border.Style>
                                                        <TextBlock Text="{Binding Estado}" Foreground="White" FontSize="10" FontWeight="Bold" HorizontalAlignment="Center"/>
                                                    </Border>
                                                </DataTemplate>
                                            </GridViewColumn.CellTemplate>
                                        </GridViewColumn>
                                        <GridViewColumn Header="Detail" Width="720" DisplayMemberBinding="{Binding Detalle}" x:Name="colDetalle"/>
                                    </GridView>
                                </ListView.View>
                            </ListView>
                        </DockPanel>
                    </Grid>
                </DockPanel>
    </DockPanel>
</Window>
"@
    $lector = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
    return [Windows.Markup.XamlReader]::Load($lector)
}

function Show-VentanaPrincipal {
    try {
        $ventana = New-VentanaPrincipalXaml

        # Fit the window to whatever screen it actually opens on, instead of the fixed
        # 1150x750 baked into the XAML - that size can be bigger than small/low-res Toughbook
        # screens (leaving the window partly off-screen) and wastes space on large/high-res
        # ones. The window still starts maximized (the safest default across any screen size),
        # but its "restored" size - what you get after clicking the restore-down button - is
        # now clamped to fit the current monitor's actual work area.
        try {
            $areaTrabajo = [System.Windows.SystemParameters]::WorkArea
            if ($areaTrabajo.Width -gt 0 -and $areaTrabajo.Height -gt 0) {
                $ventana.Width = [Math]::Max($ventana.MinWidth, [Math]::Min(1150, $areaTrabajo.Width - 40))
                $ventana.Height = [Math]::Max($ventana.MinHeight, [Math]::Min(750, $areaTrabajo.Height - 40))
            }
        }
        catch { }
        $ventana.WindowStartupLocation = [System.Windows.WindowStartupLocation]::CenterScreen
        $ventana.WindowState = [System.Windows.WindowState]::Maximized

        $Global:UI = @{
            Ventana           = $ventana
            BtnIniciar        = $ventana.FindName("btnIniciar")
            TxtBtnIniciar     = $ventana.FindName("txtBtnIniciar")
            LblEstadoActual   = $ventana.FindName("lblEstadoActual")
            BarraProgreso     = $ventana.FindName("barraProgreso")
            LblProgresoPorcentaje = $ventana.FindName("lblProgresoPorcentaje")
            ListaResultados   = $ventana.FindName("listViewResultados")
            ColComponente     = $ventana.FindName("colComponente")
            ColEstado         = $ventana.FindName("colEstado")
            ColDetalle        = $ventana.FindName("colDetalle")
            BtnGuiadas        = $ventana.FindName("btnGuiadas")
            TxtBtnGuiadas     = $ventana.FindName("txtBtnGuiadas")
            BtnGuardar        = $ventana.FindName("btnGuardar")
            TxtBtnGuardar     = $ventana.FindName("txtBtnGuardar")
            BtnCSV            = $ventana.FindName("btnCSV")
            TxtBtnCSV         = $ventana.FindName("txtBtnCSV")
            BtnExcel          = $ventana.FindName("btnExcel")
            TxtBtnExcel       = $ventana.FindName("txtBtnExcel")
            BtnReiniciar      = $ventana.FindName("btnReiniciar")
            TxtBtnReiniciar   = $ventana.FindName("txtBtnReiniciar")
            BtnCerrar         = $ventana.FindName("btnCerrar")
            TxtBtnCerrar      = $ventana.FindName("txtBtnCerrar")
            LblVersion        = $ventana.FindName("lblVersion")
            LblIdioma         = $ventana.FindName("lblIdioma")
            BtnIdiomaEN       = $ventana.FindName("btnIdiomaEN")
            BtnIdiomaES       = $ventana.FindName("btnIdiomaES")
            LblEquipo         = $ventana.FindName("lblEquipo")
            LblUsuario        = $ventana.FindName("lblUsuario")
            LblOS             = $ventana.FindName("lblOS")
            LblFecha          = $ventana.FindName("lblFecha")
            LblContadores     = $ventana.FindName("lblContadores")
            TxtStatTotal      = $ventana.FindName("txtStatTotal")
            LblStatTotal      = $ventana.FindName("lblStatTotal")
            TxtStatPass       = $ventana.FindName("txtStatPass")
            LblStatPass       = $ventana.FindName("lblStatPass")
            TxtStatFail       = $ventana.FindName("txtStatFail")
            LblStatFail       = $ventana.FindName("lblStatFail")
            TxtStatWarning    = $ventana.FindName("txtStatWarning")
            LblStatWarning    = $ventana.FindName("lblStatWarning")
            BtnFiltroAll      = $ventana.FindName("btnFiltroAll")
            BtnFiltroPass     = $ventana.FindName("btnFiltroPass")
            BtnFiltroFail     = $ventana.FindName("btnFiltroFail")
            BtnFiltroWarning  = $ventana.FindName("btnFiltroWarning")
            BtnFiltroInfo     = $ventana.FindName("btnFiltroInfo")
            LblSidebarAuto        = $ventana.FindName("lblSidebarAuto")
            PanelListaAutomaticas = $ventana.FindName("panelListaAutomaticas")
            LblSidebarGuiadas     = $ventana.FindName("lblSidebarGuiadas")
            PanelListaGuiadas     = $ventana.FindName("panelListaGuiadas")
            LblInfoPanelTitulo = $ventana.FindName("lblInfoPanelTitulo")
            LblInfoModelLabel  = $ventana.FindName("lblInfoModelLabel")
            TxtInfoModel       = $ventana.FindName("txtInfoModel")
            LblInfoSerialLabel = $ventana.FindName("lblInfoSerialLabel")
            TxtInfoSerial      = $ventana.FindName("txtInfoSerial")
            LblInfoBIOSLabel   = $ventana.FindName("lblInfoBIOSLabel")
            TxtInfoBIOS        = $ventana.FindName("txtInfoBIOS")
            LblInfoCPULabel    = $ventana.FindName("lblInfoCPULabel")
            TxtInfoCPU         = $ventana.FindName("txtInfoCPU")
            LblInfoRAMLabel      = $ventana.FindName("lblInfoRAMLabel")
            TxtInfoRAM           = $ventana.FindName("txtInfoRAM")
            PanelInfoRAMModulos  = $ventana.FindName("panelInfoRAMModulos")
            LblInfoDiskLabel   = $ventana.FindName("lblInfoDiskLabel")
            TxtInfoDisk        = $ventana.FindName("txtInfoDisk")
            TxtInfoDiskDetalle = $ventana.FindName("txtInfoDiskDetalle")
            TxtInfoDiskSerial  = $ventana.FindName("txtInfoDiskSerial")
            BtnScreenTest      = $ventana.FindName("btnScreenTest")
            TxtBtnScreenTest   = $ventana.FindName("txtBtnScreenTest")
            BtnTabCal          = $ventana.FindName("btnTabCal")
            TxtBtnTabCal       = $ventana.FindName("txtBtnTabCal")
            BtnSysprep         = $ventana.FindName("btnSysprep")
            TxtBtnSysprep      = $ventana.FindName("txtBtnSysprep")
        }

        # Keep the results table's columns proportional to the window's actual width on any
        # screen size - see Update-AnchoColumnasResultados for details.
        $Global:UI.ListaResultados.Add_SizeChanged({ Update-AnchoColumnasResultados }.GetNewClosure())

        Set-EstiloBoton -Boton $Global:UI.BtnIniciar   -ColorFondo "#0A84FF" -ColorFondoHover "#3399FF"
        Set-EstiloBoton -Boton $Global:UI.BtnGuiadas   -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
        Set-EstiloBoton -Boton $Global:UI.BtnGuardar   -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
        Set-EstiloBoton -Boton $Global:UI.BtnCSV       -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
        Set-EstiloBoton -Boton $Global:UI.BtnExcel     -ColorFondo "#00897B" -ColorFondoHover "#26A69A"
        Set-EstiloBoton -Boton $Global:UI.BtnReiniciar -ColorFondo "#C62828" -ColorFondoHover "#D32F2F"
        Set-EstiloBoton -Boton $Global:UI.BtnCerrar    -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
        Set-EstiloBoton -Boton $Global:UI.BtnIdiomaEN  -ColorFondo "#0A84FF" -ColorFondoHover "#3399FF"
        Set-EstiloBoton -Boton $Global:UI.BtnIdiomaES  -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
        Set-EstiloBoton -Boton $Global:UI.BtnScreenTest -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
        Set-EstiloBoton -Boton $Global:UI.BtnTabCal    -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
        # Amber, not the usual neutral gray - Sysprep generalizes/resets Windows setup state and
        # can shut the machine down; the color is a small visual cue that this one isn't routine,
        # on top of the confirmation dialog it always shows first.
        Set-EstiloBoton -Boton $Global:UI.BtnSysprep   -ColorFondo "#8A4B00" -ColorFondoHover "#A85A00"
        Update-EstiloFiltros

        $Global:UI.LblVersion.Text = "v$Global:VersionHerramienta"

        $Global:UI.BtnIdiomaEN.Add_Click({
            $Global:Idioma = "EN"
            Set-EstiloBoton -Boton $Global:UI.BtnIdiomaEN -ColorFondo "#0A84FF" -ColorFondoHover "#3399FF"
            Set-EstiloBoton -Boton $Global:UI.BtnIdiomaES -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
            Update-IdiomaUI
            Update-PanelInfoEquipo
        })
        $Global:UI.BtnIdiomaES.Add_Click({
            $Global:Idioma = "ES"
            Set-EstiloBoton -Boton $Global:UI.BtnIdiomaES -ColorFondo "#0A84FF" -ColorFondoHover "#3399FF"
            Set-EstiloBoton -Boton $Global:UI.BtnIdiomaEN -ColorFondo "#3A3A3A" -ColorFondoHover "#4A4A4A"
            Update-IdiomaUI
            Update-PanelInfoEquipo
        })

        $Global:UI.BtnFiltroAll.Add_Click({
            $Global:FiltroEstadoActual = "ALL"
            Update-EstiloFiltros
            Update-ListaResultados
        })
        $Global:UI.BtnFiltroPass.Add_Click({
            $Global:FiltroEstadoActual = "PASS"
            Update-EstiloFiltros
            Update-ListaResultados
        })
        $Global:UI.BtnFiltroFail.Add_Click({
            $Global:FiltroEstadoActual = "FAIL"
            Update-EstiloFiltros
            Update-ListaResultados
        })
        $Global:UI.BtnFiltroWarning.Add_Click({
            $Global:FiltroEstadoActual = "WARNING"
            Update-EstiloFiltros
            Update-ListaResultados
        })
        $Global:UI.BtnFiltroInfo.Add_Click({
            $Global:FiltroEstadoActual = "INFO"
            Update-EstiloFiltros
            Update-ListaResultados
        })

        $Global:UI.BtnIniciar.Add_Click({
            try {
                $Global:UI.BtnIniciar.IsEnabled = $false
                $Global:PruebaEnCurso = $true

                # Order/Unit number and WiFi credentials no longer come from a Settings tab - the
                # unit number defaults to the detected serial number (see the console pre-flight
                # in Main) and WiFi uses the hardcoded defaults in the Variables region.
                Update-PanelInfoEquipo

                $Global:TiempoInicioEjecucion = Get-Date
                Invoke-PruebasAutomaticas
                Update-BarraEstado

                # Re-render the equipment info panel now that Phase 1 has run, in case anything
                # changed (unlikely, but cheap to re-check).
                Update-PanelInfoEquipo

                $duracion = [math]::Round(((Get-Date) - $Global:TiempoInicioEjecucion).TotalSeconds, 2)
                $Global:UI.LblEstadoActual.Text = Tx "Progress.Phase1Summary" $duracion
            }
            catch {
                Show-DialogoInfo (Tx "Dialog.StartError" $_.Exception.Message) (Tx "Dialog.ErrorTitle")
            }
            finally {
                $Global:UI.BtnIniciar.IsEnabled = $true
                $Global:PruebaEnCurso = $false
            }
        })

        $Global:UI.BtnGuiadas.Add_Click({
            try {
                $Global:UI.BtnGuiadas.IsEnabled = $false
                $Global:PruebaEnCurso = $true
                Invoke-PruebasInteractivas
                Update-BarraEstado

                Preguntar-InfoOrden
                $comentario = Ask-Texto (Tx "Dialog.Comment")
                $Global:DatosExportacion.Comentario = $comentario
                [void](Export-FilaExcel -Silencioso)
                $Global:UI.LblEstadoActual.Text = Tx "Progress.Phase2Done"
            }
            catch {
                Show-DialogoInfo (Tx "Dialog.GuidedError" $_.Exception.Message) (Tx "Dialog.ErrorTitle")
            }
            finally {
                $Global:UI.BtnGuiadas.IsEnabled = $true
                $Global:PruebaEnCurso = $false
            }
        })

        $Global:UI.BtnGuardar.Add_Click({ Save-ReporteTexto | Out-Null })
        $Global:UI.BtnCSV.Add_Click({ Export-ReporteCSV | Out-Null })
        $Global:UI.BtnExcel.Add_Click({ Preguntar-InfoOrden; Export-FilaExcel | Out-Null })

        $Global:UI.BtnScreenTest.Add_Click({
            if ($Global:PruebaEnCurso) { return }
            try {
                $Global:PruebaEnCurso = $true
                if ($Global:UI.LblEstadoActual) {
                    $Global:UI.LblEstadoActual.Text = Tx "Progress.RunningOne" (Tx "Side.ScreenTest")
                    Invoke-WpfDoEvents
                }
                Invoke-PruebaMedida -Nombre "Screen Test" -Accion { Test-PruebaColores-Interactivo } -Patrones @("Screen Test")
                Update-ListaResultados
                Update-BarraEstado
                if ($Global:UI.LblEstadoActual) { $Global:UI.LblEstadoActual.Text = Tx "Progress.Phase1Done" }
            }
            catch { }
            finally {
                $Global:PruebaEnCurso = $false
            }
        })

        $Global:UI.BtnTabCal.Add_Click({
            try {
                Start-Process "tabcal.exe" -ErrorAction Stop
            }
            catch {
                Show-DialogoInfo (Tx "Dialog.TabCalError" $_.Exception.Message) (Tx "Dialog.ErrorTitle")
            }
        })

        $Global:UI.BtnSysprep.Add_Click({
            try {
                if (-not (Show-DialogoConfirmacion (Tx "Dialog.SysprepConfirm") (Tx "Dialog.SysprepTitle"))) { return }
                $rutaSysprep = Join-Path -Path $env:WINDIR -ChildPath "System32\Sysprep\sysprep.exe"
                if (-not (Test-Path -Path $rutaSysprep)) { throw (Tx "Dialog.SysprepNotFound") }
                Start-Process -FilePath $rutaSysprep -ErrorAction Stop
            }
            catch {
                Show-DialogoInfo (Tx "Dialog.SysprepError" $_.Exception.Message) (Tx "Dialog.ErrorTitle")
            }
        })

        $Global:UI.BtnReiniciar.Add_Click({
            try {
                if (Show-DialogoConfirmacion (Tx "Dialog.RestartConfirm") (Tx "Dialog.RestartTitle")) {
                    Restart-Computer -Force
                }
            }
            catch {
                Show-DialogoInfo (Tx "Dialog.RestartError" $_.Exception.Message) (Tx "Dialog.ErrorTitle")
            }
        })

        $Global:UI.BtnCerrar.Add_Click({
            try {
                if ($Global:Resultados.Count -gt 0 -and -not $Global:ExportacionRealizada) {
                    if (Show-DialogoConfirmacion (Tx "Dialog.ExportBeforeClose") (Tx "Dialog.ExportBeforeCloseTitle")) {
                        Preguntar-InfoOrden
                        $Global:DatosExportacion.Comentario = Ask-Texto (Tx "Dialog.Comment")
                        [void](Export-FilaExcel -Silencioso)
                    }
                }
            }
            catch { }
            finally {
                $Global:UI.Ventana.Close()
            }
        })

        Initialize-PanelSidebar
        Update-IdiomaUI
        # Query and render the equipment info panel right away so it shows real data from the
        # first frame instead of "-" placeholders.
        Update-PanelInfoEquipo
        # Windows Update / WiFi / Windows Activation already ran during the console pre-flight
        # (see Main region), so their sidebar tiles need to show the real PASS/FAIL/WARNING color
        # immediately too, instead of looking untested until "Start Automatic Diagnostics" is
        # clicked or the tile is run again by hand.
        foreach ($nombrePrueba in @("Windows Update", "WiFi", "Windows Activation")) {
            if ($Global:CatalogoPruebasAutomaticas.Contains($nombrePrueba)) {
                Update-FilaSidebarEstado -Nombre $nombrePrueba -Patrones $Global:CatalogoPruebasAutomaticas[$nombrePrueba].Patrones
            }
        }
        Update-ListaResultados
        Update-BarraEstado

        [void]$ventana.ShowDialog()
    }
    catch {
        Write-Host "Critical error showing the main window: $($_.Exception.Message)" -ForegroundColor Red
        try { Show-DialogoInfo (Tx "Dialog.CriticalUI" $_.Exception.Message) (Tx "Dialog.ErrorTitle") } catch { }
    }
}
#endregion GUI


#region Main
try {
    # Pure ASCII banner (no box-drawing / Unicode characters) - a .ps1 file with non-ASCII bytes
    # and no UTF-8 BOM can get misread under the system's ANSI codepage when launched via "-File"
    # (as the compiled Launcher.exe does), which can corrupt the file's own tokenization. Sticking
    # to plain ASCII here removes that risk entirely regardless of how the script is started.
    Write-Host ""
    Write-Host "     _  ___ _____ _   _    _    ____  " -ForegroundColor Cyan
    Write-Host "    | |/ _ \_   _| \ | |  / \  |  _ \ " -ForegroundColor Cyan
    Write-Host " _  | | | | || | |  \| | / _ \ | |_) |" -ForegroundColor Cyan
    Write-Host "| |_| | |_| || | | |\  |/ ___ \|  _ < " -ForegroundColor Cyan
    Write-Host " \___/ \___/ |_| |_| \_/_/   \_\_| \_\" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host " HARDWARE DIAGNOSTICS TOOL" -ForegroundColor Gray
    Write-Host " Version $Global:VersionHerramienta" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor DarkGray

    $scriptPath = $PSCommandPath
    if (-not $scriptPath) { $scriptPath = $MyInvocation.MyCommand.Path }

    $exeActual = (Get-Process -Id $PID).Path
    $nombreHostActual = if ($exeActual) { Split-Path -Path $exeActual -Leaf } else { "" }
    # True only when this code is being interpreted live by powershell.exe/pwsh.exe from the .ps1
    # file. False when running from a compiled .exe (e.g. built with ps2exe) - a compiled exe is
    # not powershell.exe, so re-launching it with PowerShell switches like -File/-STA/-NoProfile
    # does nothing useful: the exe doesn't understand them, the relaunch silently fails to start a
    # working copy, and the original process still calls "exit" right after - which looks exactly
    # like "the program closes immediately with no error".
    $esHostPowerShell = $nombreHostActual -in @('powershell.exe', 'pwsh.exe')

    $necesitaAdmin = -not (Test-EsAdministrador)
    $necesitaSTA   = ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne [System.Threading.ApartmentState]::STA)

    if ($esHostPowerShell) {
        if (($necesitaAdmin -or $necesitaSTA) -and $scriptPath) {
            Write-Host "Relaunching the tool with the required permissions/mode..." -ForegroundColor Yellow

            $argumentos = @('-NoProfile', '-ExecutionPolicy', 'Bypass')
            if ($necesitaSTA) { $argumentos += '-STA' }
            $argumentos += @('-File', $scriptPath)

            $parametrosProceso = @{
                FilePath     = $exeActual
                ArgumentList = $argumentos
            }
            if ($necesitaAdmin) { $parametrosProceso['Verb'] = 'RunAs' }

            Start-Process @parametrosProceso
            exit
        }
    }
    else {
        # Compiled .exe path: only self-relaunch for admin elevation (that's a plain Windows "run
        # this exe as Administrator" and works the same for any exe). STA can't be fixed this way -
        # it has to be set when the exe was compiled (e.g. "Invoke-ps2exe ... -STA"), so if it's
        # wrong here we just say so clearly instead of silently failing to relaunch.
        if ($necesitaAdmin) {
            Write-Host "Relaunching the tool as Administrator..." -ForegroundColor Yellow
            Start-Process -FilePath $exeActual -Verb RunAs
            exit
        }
        if ($necesitaSTA) {
            $mensajeSTA = "This tool needs to run in STA mode, but this .exe was built without STA support.`n`nRebuild it with the STA option (for example: Invoke-ps2exe -inputFile Diagnostico-Hardware.ps1 -outputFile Diagnostico-Hardware.exe -STA -requireAdmin) and try again."
            try {
                Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
                [System.Windows.Forms.MessageBox]::Show($mensajeSTA, "Hardware Diagnostics - STA required", 'OK', 'Error') | Out-Null
            }
            catch {
                Write-Host $mensajeSTA -ForegroundColor Red
            }
            exit
        }
    }

    Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Xaml
    Add-Type -AssemblyName System.Windows.Forms

    # Load the real WiFi SSID/password from wifi-config.txt (if present) before anything that
    # might use them - Test-Wifi now runs as part of the pre-flight below.
    Import-ConfiguracionWifi

    # Identify the equipment (Model/Serial/BIOS/CPU/RAM/Disk) right here in the console, before
    # the window opens - it's a handful of quick, read-only WMI queries with no dependency on
    # anything the technician has to configure first. The result is cached (Get-InfoEquipo) so
    # the sidebar panel is already filled in the moment the interface appears, instead of showing
    # "-" placeholders until later.
    Write-Host ""
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host " DETECTING EQUIPMENT" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host ""
    $Global:InfoEquipoCache = Get-InfoEquipo -MostrarProgreso
    # The report's "unit" identifier now defaults to the detected serial number instead of a
    # manually-typed field (there's no more Settings tab to type it into).
    if ($Global:InfoEquipoCache -and $Global:InfoEquipoCache.Serial) {
        $Global:DatosExportacion.NumberUnit = $Global:InfoEquipoCache.Serial
    }

    # Windows Update, WiFi, and Windows Activation also run here, before the window opens, same
    # as equipment detection above - none of the three needs the interface either (Test-Wifi,
    # Test-WindowsUpdateService, Test-WindowsActivation only touch $Global:Resultados via
    # Add-Result, which has no $Global:UI dependency). They stay in $Global:CatalogoPruebasAutomaticas
    # too, so "Start Automatic Diagnostics" can still refresh them later (e.g. after moving to a
    # different WiFi network) - Invoke-PruebaMedida's Patrones-based clearing means a second run
    # simply replaces this pre-flight result instead of stacking on top of it.
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host " RUNNING INITIAL SYSTEM CHECKS" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host ""

    $pruebasPreVuelo = [ordered]@{
        "Windows Update"     = @{ Accion = { Test-WindowsUpdateService }; Patrones = @("Windows Update") }
        "WiFi"               = @{ Accion = { Test-Wifi };                Patrones = @("WiFi") }
        "Windows Activation" = @{ Accion = { Test-WindowsActivation };    Patrones = @("Windows Activation") }
    }
    $pasoPreVuelo = 0
    foreach ($nombrePruebaPreVuelo in $pruebasPreVuelo.Keys) {
        $pasoPreVuelo++
        $lineaPreVuelo = "-" * 40
        Write-Host $lineaPreVuelo -ForegroundColor DarkGray
        Write-Host (" [{0}/{1}] {2}" -f $pasoPreVuelo, $pruebasPreVuelo.Count, $nombrePruebaPreVuelo.ToUpper()) -ForegroundColor Cyan
        Write-Host $lineaPreVuelo -ForegroundColor DarkGray
        Invoke-PruebaMedida -Nombre $nombrePruebaPreVuelo -Accion $pruebasPreVuelo[$nombrePruebaPreVuelo].Accion -Patrones $pruebasPreVuelo[$nombrePruebaPreVuelo].Patrones
        Write-Host ""
    }

    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host " INITIAL CHECKS COMPLETE - OPENING UI" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor DarkGray
    Write-Host ""

    Show-VentanaPrincipal
}
catch {
    Write-Host "Critical error running the script: $($_.Exception.Message)" -ForegroundColor Red
    try {
        Add-Type -AssemblyName PresentationFramework -ErrorAction SilentlyContinue
        Show-DialogoInfo "Critical error: $($_.Exception.Message)" "Error"
    }
    catch { }
}
#endregion Main
