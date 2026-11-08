import {
  Battery6Regular,
  DesktopRegular,
  DeveloperBoardSearchRegular,
  HardDriveRegular,
  HomeRegular,
  KeyboardMouseRegular,
  PeopleRegular,
  Speaker2Regular,
  TapSingleRegular,
  UsbPlugRegular,
  Wifi1Regular,
  WrenchScrewdriverRegular
} from '@fluentui/react-icons'

// WinDiag Bench's navigation: the first item is the start page by default
export const BENCH_NAV = [
  {
    items: [{ id: 'overview', label: 'Overview', icon: HomeRegular }]
  },
  {
    header: 'Hardware tests',
    items: [
      { id: 'display', label: 'Display', icon: DesktopRegular },
      { id: 'touch', label: 'Touch', icon: TapSingleRegular },
      { id: 'keyboard', label: 'Keyboard & mouse', icon: KeyboardMouseRegular },
      { id: 'audio', label: 'Audio & camera', icon: Speaker2Regular },
      { id: 'battery', label: 'Battery', icon: Battery6Regular },
      { id: 'disk', label: 'Disk health', icon: HardDriveRegular },
      { id: 'ports', label: 'USB ports', icon: UsbPlugRegular },
      { id: 'otherDevices', label: 'Wireless & peripherals', icon: Wifi1Regular }
    ]
  },
  {
    header: 'Tools',
    items: [
      { id: 'tools', label: 'Technician tools', icon: WrenchScrewdriverRegular },
      { id: 'drivers', label: 'Drivers', icon: DeveloperBoardSearchRegular },
      { id: 'users', label: 'Users', icon: PeopleRegular }
    ]
  }
]
