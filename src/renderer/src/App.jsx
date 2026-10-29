import { useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { SettingsProvider } from '@/context/SettingsContext'
import { SystemInfoProvider } from '@/context/SystemInfoContext'
import { AudioModule } from '@/modules/AudioModule'
import { BatteryModule } from '@/modules/BatteryModule'
import { DiskModule } from '@/modules/DiskModule'
import { DriversModule } from '@/modules/DriversModule'
import { OtherDevicesModule } from '@/modules/OtherDevicesModule'
import { DisplayModule } from '@/modules/DisplayModule'
import { PortsModule } from '@/modules/PortsModule'
import { SettingsModule } from '@/modules/SettingsModule'
import { OverviewModule } from '@/modules/OverviewModule'
import { TouchModule } from '@/modules/TouchModule'
import { KeyboardModule } from '@/modules/KeyboardModule'
import { ToolsModule } from '@/modules/ToolsModule'
import { UsersModule } from '@/modules/UsersModule'

const MODULES = {
  overview: OverviewModule,
  display: DisplayModule,
  touch: TouchModule,
  keyboard: KeyboardModule,
  audio: AudioModule,
  battery: BatteryModule,
  disk: DiskModule,
  ports: PortsModule,
  otherDevices: OtherDevicesModule,
  tools: ToolsModule,
  drivers: DriversModule,
  users: UsersModule,
  settings: SettingsModule
}

// Modules that display the live readings from SystemInfoProvider
const LIVE_DATA_MODULES = new Set(['battery'])

export function App({ titleBarHeight, micaSupported, initialSettings, onSettingsChange }) {
  const [activeModule, setActiveModule] = useState(() =>
    MODULES[initialSettings.startPage] ? initialSettings.startPage : 'overview'
  )
  const ActiveModule = MODULES[activeModule]
  return (
    // The providers live above the page switcher, so they don't unmount when
    // the active page changes: the hardware snapshot and live readings
    // persist across pages instead of being re-fetched every time.
    <SettingsProvider initialSettings={initialSettings} onChange={onSettingsChange}>
      <SystemInfoProvider live={LIVE_DATA_MODULES.has(activeModule)}>
        <AppShell
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          titleBarHeight={titleBarHeight}
        >
          <ActiveModule onNavigate={setActiveModule} micaSupported={micaSupported} />
        </AppShell>
      </SystemInfoProvider>
    </SettingsProvider>
  )
}
