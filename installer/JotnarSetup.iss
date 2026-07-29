; ====================================================================================
; JotnarSetup.iss - Inno Setup script for the Hardware Diagnostics Tool
; ====================================================================================
; Produces a real Windows installer (Setup.exe): installs to Program Files, creates
; Start Menu / optional Desktop shortcuts, and registers a proper uninstaller in
; "Apps & Features". This is the "install it with a .exe" distribution path -
; distinct from the portable .exe produced by app/build.bat, which just runs in
; place without installing anywhere.
;
; Requires Inno Setup (free): https://jrsoftware.org/isinfo.php
;
; Build order:
;   1. Run app/build.bat first, so app/Diagnostico-Hardware.exe (and the icon,
;      Runa-M.ico) already exist - this script packages the already-built output,
;      it does not compile the C# launcher itself.
;   2. Open this file in Inno Setup and click Compile (or run ISCC.exe against it
;      from the command line). The finished Setup.exe is written to ../dist/.
;
; See .github/workflows/release.yml for how this is done automatically on every
; tagged release.
; ====================================================================================

#define MyAppName "Hardware Diagnostics Tool"
#define MyAppVersion "3.0.0"
#define MyAppPublisher "Jotnar"
#define MyAppURL "https://github.com/JotnarDev/hardware-diagnostics-tool"
#define MyAppExeName "Diagnostico-Hardware.exe"

[Setup]
AppId={{B4B6F1B0-6A9A-4C9E-9C7B-5F0A7B2E9A11}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\Jotnar Hardware Diagnostics
DefaultGroupName=Jotnar Hardware Diagnostics
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=JotnarHardwareDiagnostics-Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
; The tool self-elevates on its own (UAC prompt at launch), so the installer itself
; doesn't strictly need to run elevated - but installing to Program Files does.
PrivilegesRequired=admin
SetupIconFile=..\app\Runa-M.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\app\Diagnostico-Hardware.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\app\Diagnostico-Hardware.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\app\wifi-config.example.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\app\Runa-M.ico"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; USB installer companion tool - only bundled if it was also built by build.bat.
Source: "..\app\InstaladorUSB.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\app\Instalar-USB.ps1"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
; Optional third-party tools - only bundled if you've added your own local copies to
; app/ before building (not included in the repository, see docs/BUILD.md).
Source: "..\app\keytest.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\app\BatteryInfoView.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\app\BatteryInfoView.cfg"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
