import { needsAdmin, readSettings, writeSettings } from './registry-settings'

/*
 * The home edition's Personalize page: how Windows looks and behaves. Every
 * option can be set back from the same page; "Windows default" is marked in
 * the page.
 *
 * Several follow the tweaks in Chris Titus Tech's WinUtil (MIT licence,
 * © 2022 CT Tech Group LLC), written again here.
 */

const ADVANCED = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'
const THEMES = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'
const CLASSIC_MENU = 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}'

const dword = (path, name, value, orAbsent = false) => ({
  path,
  name,
  type: 'DWord',
  value,
  orAbsent
})
const string = (path, name, value, orAbsent = false, alsoMatches = []) => ({
  path,
  name,
  type: 'String',
  value,
  orAbsent,
  alsoMatches
})

// Windows 10 and 11 often store Num Lock with the top bit set as well
const NUMLOCK_ON = ['2147483650']
const NUMLOCK_OFF = ['2147483648']

// Tells open windows that a setting changed, the way Settings does, so the
// theme updates without signing out
const BROADCAST = String.raw`
if (-not ('WinDiag.Broadcast' -as [type])) {
    Add-Type -Namespace WinDiag -Name Broadcast -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)]
public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
'@
}
$r = [UIntPtr]::Zero
[void][WinDiag.Broadcast]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'ImmersiveColorSet', 2, 1000, [ref]$r)
`

// Applies the mouse acceleration values now, as the Mouse control panel does
const APPLY_MOUSE = (option) => {
  const values = option === 'on' ? '6, 10, 1' : '0, 0, 0'
  return String.raw`
if (-not ('WinDiag.Mouse' -as [type])) {
    Add-Type -Namespace WinDiag -Name Mouse -MemberDefinition @'
[DllImport("user32.dll")]
public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, int[] pvParam, uint fWinIni);
'@
}
[void][WinDiag.Mouse]::SystemParametersInfo(0x0004, 0, [int[]]@(${values}), 3)
`
}

// Sticky Keys' shortcut (Shift five times), applied now
const APPLY_STICKY = (option) => String.raw`
if (-not ('WinDiag.Sticky' -as [type])) {
    Add-Type -Namespace WinDiag -Name Sticky -MemberDefinition @'
[StructLayout(LayoutKind.Sequential)]
public struct STICKYKEYS { public uint cbSize; public uint dwFlags; }
[DllImport("user32.dll")]
public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, ref STICKYKEYS pvParam, uint fWinIni);
'@
}
$sk = New-Object WinDiag.Sticky+STICKYKEYS
$sk.cbSize = 8
$sk.dwFlags = ${option === 'on' ? 510 : 506}
[void][WinDiag.Sticky]::SystemParametersInfo(0x003B, 8, [ref]$sk, 3)
`

export const PERSONALIZE_SETTINGS = [
  {
    id: 'theme',
    group: 'look',
    options: {
      light: [
        dword(THEMES, 'AppsUseLightTheme', 1, true),
        dword(THEMES, 'SystemUsesLightTheme', 1, true)
      ],
      dark: [dword(THEMES, 'AppsUseLightTheme', 0), dword(THEMES, 'SystemUsesLightTheme', 0)]
    },
    defaultOption: 'light',
    apply: () => BROADCAST
  },
  {
    id: 'fileExtensions',
    group: 'explorer',
    explorer: true,
    options: {
      on: [dword(ADVANCED, 'HideFileExt', 0)],
      off: [dword(ADVANCED, 'HideFileExt', 1, true)]
    },
    defaultOption: 'off'
  },
  {
    id: 'hiddenFiles',
    group: 'explorer',
    explorer: true,
    options: { on: [dword(ADVANCED, 'Hidden', 1)], off: [dword(ADVANCED, 'Hidden', 2, true)] },
    defaultOption: 'off'
  },
  {
    id: 'openToThisPc',
    group: 'explorer',
    explorer: true,
    options: { on: [dword(ADVANCED, 'LaunchTo', 1)], off: [dword(ADVANCED, 'LaunchTo', null)] },
    defaultOption: 'off'
  },
  {
    id: 'classicMenu',
    group: 'explorer',
    explorer: true,
    options: {
      on: [{ path: `${CLASSIC_MENU}\\InprocServer32`, type: 'Key', value: true }],
      off: [{ path: CLASSIC_MENU, type: 'Key', value: false }]
    },
    defaultOption: 'off'
  },
  {
    id: 'taskbarAlignment',
    group: 'taskbar',
    explorer: true,
    options: {
      left: [dword(ADVANCED, 'TaskbarAl', 0)],
      center: [dword(ADVANCED, 'TaskbarAl', 1, true)]
    },
    defaultOption: 'center'
  },
  {
    id: 'taskbarSearch',
    group: 'taskbar',
    explorer: true,
    options: {
      hidden: [
        dword(
          'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search',
          'SearchboxTaskbarMode',
          0
        )
      ],
      icon: [
        dword(
          'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search',
          'SearchboxTaskbarMode',
          1
        )
      ],
      box: [
        dword(
          'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search',
          'SearchboxTaskbarMode',
          2,
          true
        )
      ]
    },
    defaultOption: 'box'
  },
  {
    id: 'taskView',
    group: 'taskbar',
    explorer: true,
    options: {
      on: [dword(ADVANCED, 'ShowTaskViewButton', 1, true)],
      off: [dword(ADVANCED, 'ShowTaskViewButton', 0)]
    },
    defaultOption: 'on'
  },
  {
    // Recent Windows 11 blocks apps from writing the user's TaskbarDa
    // value, so Widgets is turned off with its policy (admin rights)
    id: 'widgets',
    group: 'taskbar',
    explorer: true,
    options: {
      on: [dword('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh', 'AllowNewsAndInterests', null)],
      off: [dword('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Dsh', 'AllowNewsAndInterests', 0)]
    },
    defaultOption: 'on'
  },
  {
    id: 'endTask',
    group: 'taskbar',
    explorer: true,
    options: {
      on: [dword(`${ADVANCED}\\TaskbarDeveloperSettings`, 'TaskbarEndTask', 1)],
      off: [dword(`${ADVANCED}\\TaskbarDeveloperSettings`, 'TaskbarEndTask', 0, true)]
    },
    defaultOption: 'off'
  },
  {
    id: 'mouseAcceleration',
    group: 'input',
    options: {
      on: [
        string('HKCU:\\Control Panel\\Mouse', 'MouseSpeed', '1', true),
        string('HKCU:\\Control Panel\\Mouse', 'MouseThreshold1', '6', true),
        string('HKCU:\\Control Panel\\Mouse', 'MouseThreshold2', '10', true)
      ],
      off: [
        string('HKCU:\\Control Panel\\Mouse', 'MouseSpeed', '0'),
        string('HKCU:\\Control Panel\\Mouse', 'MouseThreshold1', '0'),
        string('HKCU:\\Control Panel\\Mouse', 'MouseThreshold2', '0')
      ]
    },
    defaultOption: 'on',
    apply: APPLY_MOUSE
  },
  {
    id: 'stickyKeys',
    group: 'input',
    options: {
      on: [string('HKCU:\\Control Panel\\Accessibility\\StickyKeys', 'Flags', '510', true)],
      off: [string('HKCU:\\Control Panel\\Accessibility\\StickyKeys', 'Flags', '506')]
    },
    defaultOption: 'on',
    apply: APPLY_STICKY
  },
  {
    // At the sign-in screen (the default user) and after signing in
    id: 'numLock',
    group: 'input',
    signIn: true,
    options: {
      on: [
        string(
          'HKCU:\\Control Panel\\Keyboard',
          'InitialKeyboardIndicators',
          '2',
          false,
          NUMLOCK_ON
        ),
        string(
          'Registry::HKEY_USERS\\.DEFAULT\\Control Panel\\Keyboard',
          'InitialKeyboardIndicators',
          '2',
          false,
          NUMLOCK_ON
        )
      ],
      off: [
        string(
          'HKCU:\\Control Panel\\Keyboard',
          'InitialKeyboardIndicators',
          '0',
          true,
          NUMLOCK_OFF
        ),
        string(
          'Registry::HKEY_USERS\\.DEFAULT\\Control Panel\\Keyboard',
          'InitialKeyboardIndicators',
          '0',
          true,
          NUMLOCK_OFF
        )
      ]
    },
    defaultOption: 'off'
  }
]

/** Each setting's current option, and what applying it needs. */
export async function getPersonalizeSettings() {
  const current = await readSettings(PERSONALIZE_SETTINGS)
  return PERSONALIZE_SETTINGS.map((setting, i) => ({
    id: setting.id,
    group: setting.group,
    option: current[i].option,
    options: Object.keys(setting.options),
    defaultOption: setting.defaultOption,
    admin: needsAdmin(setting),
    explorer: Boolean(setting.explorer),
    signIn: Boolean(setting.signIn)
  }))
}

export function setPersonalizeSettings(changes) {
  return writeSettings(PERSONALIZE_SETTINGS, changes, 'Personalize')
}
