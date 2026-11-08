import { comingSoonPage } from '@/home/ComingSoonPage'
import { HomeOverview } from '@/home/HomeOverview'
import { SettingsModule } from '@/modules/SettingsModule'
import { HOME_NAV } from './home-nav'

/** WinDiag (home): keep your own PC healthy, safely, in plain words. */
export const home = {
  id: 'home',
  title: 'WinDiag',
  navGroups: HOME_NAV,
  modules: {
    overview: HomeOverview,
    speed: comingSoonPage({
      title: 'Speed up',
      description: 'Start faster and free up space.',
      plans: [
        'Apps that start with Windows, with their impact and a switch for each',
        'Clean up temporary files, Disk Cleanup and the Recycle Bin, with the space you get back',
        'Power plan: balanced or best performance'
      ]
    }),
    privacy: comingSoonPage({
      title: 'Privacy',
      description: 'Decide what Windows shares and shows you.',
      plans: [
        'Telemetry, activity history and location',
        'Suggested apps, Store and Bing results in Start and search',
        'Each switch explained, and every change can be undone'
      ]
    }),
    personalize: comingSoonPage({
      title: 'Personalize',
      description: 'Make Windows work the way you like.',
      plans: [
        'Dark mode, file extensions, hidden files and battery percentage',
        'Taskbar: alignment, Widgets, search and Task View',
        'End task from the taskbar, the classic right-click menu, Sticky Keys and Num Lock'
      ]
    }),
    apps: comingSoonPage({
      title: 'Apps',
      description: 'Install trusted apps and keep them up to date.',
      plans: [
        'Collections for productivity, gaming, design and development',
        'Shows what is already installed',
        'Update all your apps in one click'
      ]
    }),
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
    hardware: comingSoonPage({
      title: 'Hardware',
      description: 'Check that a part of your PC works.',
      plans: [
        'Keyboard, screen, speakers, microphone and camera tests',
        'Battery and drive health in plain words'
      ]
    }),
    settings: SettingsModule
  },
  liveModules: new Set(),
  // Asks for admin rights only for the actions that need them
  showRunAsAdmin: false,
  settings: { tests: false, drivers: false }
}
export default home
