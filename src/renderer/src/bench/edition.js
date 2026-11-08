import { AudioModule } from '@/modules/AudioModule'
import { BatteryModule } from '@/modules/BatteryModule'
import { DiskModule } from '@/modules/DiskModule'
import { DisplayModule } from '@/modules/DisplayModule'
import { DriversModule } from '@/bench/DriversModule'
import { GamepadModule } from '@/modules/GamepadModule'
import { KeyboardModule } from '@/modules/KeyboardModule'
import { OtherDevicesModule } from '@/modules/OtherDevicesModule'
import { OverviewModule } from '@/bench/OverviewModule'
import { PortsModule } from '@/modules/PortsModule'
import { SettingsModule } from '@/modules/SettingsModule'
import { ToolsModule } from '@/bench/ToolsModule'
import { TouchModule } from '@/modules/TouchModule'
import { UsersModule } from '@/bench/UsersModule'
import { BENCH_NAV } from './nav'

/** WinDiag Bench: test, fix and hand over PCs (refurbishers and technicians). */
export const bench = {
  id: 'bench',
  title: 'WinDiag',
  navGroups: BENCH_NAV,
  modules: {
    overview: OverviewModule,
    display: DisplayModule,
    touch: TouchModule,
    keyboard: KeyboardModule,
    audio: AudioModule,
    battery: BatteryModule,
    disk: DiskModule,
    ports: PortsModule,
    otherDevices: OtherDevicesModule,
    gamepad: GamepadModule,
    tools: ToolsModule,
    drivers: DriversModule,
    users: UsersModule,
    settings: SettingsModule
  },
  // Pages that show the live readings, which then refresh every few seconds
  liveModules: new Set(['overview', 'battery']),
  // The app asks for admin rights at launch; this offers a relaunch if it didn't get them
  showRunAsAdmin: true,
  // Settings sections only this edition has
  settings: { tests: true, drivers: true }
}
export default bench
