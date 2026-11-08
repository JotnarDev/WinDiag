import { comingSoonPage } from '@/home/ComingSoonPage'
import { HomeOverview } from '@/home/HomeOverview'
import { SpeedPage } from '@/home/SpeedPage'
import { PrivacyPage } from '@/home/PrivacyPage'
import { PersonalizePage } from '@/home/PersonalizePage'
import { AppsPage } from '@/home/AppsPage'
import { HARDWARE_TESTS, HardwarePage } from '@/home/HardwarePage'
import { AudioModule } from '@/modules/AudioModule'
import { BatteryModule } from '@/modules/BatteryModule'
import { DiskModule } from '@/modules/DiskModule'
import { DisplayModule } from '@/modules/DisplayModule'
import { GamepadModule } from '@/modules/GamepadModule'
import { KeyboardModule } from '@/modules/KeyboardModule'
import { PortsModule } from '@/modules/PortsModule'
import { TouchModule } from '@/modules/TouchModule'
import { SettingsModule } from '@/modules/SettingsModule'
import { HOME_NAV } from './home-nav'

/** WinDiag (home): keep your own PC healthy, safely, in plain words. */
export const home = {
  id: 'home',
  title: 'WinDiag',
  navGroups: HOME_NAV,
  modules: {
    overview: HomeOverview,
    speed: SpeedPage,
    privacy: PrivacyPage,
    personalize: PersonalizePage,
    apps: AppsPage,
    updates: comingSoonPage({
      title: 'Updates',
      description: 'Windows, drivers and BIOS, kept up to date.',
      plans: [
        'Pending Windows updates and a button to install them',
        'Drivers from Windows Update and the maker, with a restore point first',
        'A notice when a newer BIOS exists, with a link to the maker'
      ]
    }),
    security: comingSoonPage({
      title: 'Security',
      description: 'Is this PC protected?',
      plans: ['Microsoft Defender, firewall, BitLocker, activation and pending updates at a glance']
    }),
    repair: comingSoonPage({
      title: 'Repair',
      description: 'Fix common Windows problems.',
      plans: [
        'Scan and repair system files',
        'Reset the network or Windows Update',
        'Create a restore point or go back to one'
      ]
    }),
    hardware: HardwarePage,
    // Hardware tests, shared with Bench, opened from the Hardware page
    gamepad: GamepadModule,
    keyboard: KeyboardModule,
    display: DisplayModule,
    touch: TouchModule,
    audio: AudioModule,
    battery: BatteryModule,
    disk: DiskModule,
    ports: PortsModule,
    settings: SettingsModule
  },
  // Pages that show the live readings, which then refresh every few seconds
  liveModules: new Set(['battery']),
  // Pages without a navigation item, and the item that stays selected on them
  parentOf: Object.fromEntries(HARDWARE_TESTS.map((test) => [test.id, 'hardware'])),
  // Asks for admin rights only for the actions that need them
  showRunAsAdmin: false,
  settings: { tests: false, drivers: false }
}
export default home
