import { useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { PortsProvider } from '@/context/PortsContext'
import { SystemInfoProvider } from '@/context/SystemInfoContext'
import { AudioModule } from '@/modules/AudioModule'
import { BatteryModule } from '@/modules/BatteryModule'
import { DiskModule } from '@/modules/DiskModule'
import { OtherDevicesModule } from '@/modules/OtherDevicesModule'
import { DisplayModule } from '@/modules/DisplayModule'
import { PortsModule } from '@/modules/PortsModule'
import { OverviewModule } from '@/modules/OverviewModule'
import { TouchModule } from '@/modules/TouchModule'
import { KeyboardModule } from '@/modules/KeyboardModule'
import { UsersModule } from '@/modules/UsersModule'

// Modules that display the live readings from SystemInfoProvider
const LIVE_DATA_MODULES = new Set(['battery'])

export function App() {
  const [activeModule, setActiveModule] = useState('overview')
  return (
    // Both providers live above the tab switcher below, so neither unmounts
    // when the active module changes: the hardware snapshot and live
    // readings (dashboard, battery) and the ports snapshot both persist
    // across tab switches instead of being re-fetched every time.
    <SystemInfoProvider live={LIVE_DATA_MODULES.has(activeModule)}>
      <PortsProvider>
        <AppShell activeModule={activeModule} onSelectModule={setActiveModule} />
      </PortsProvider>
    </SystemInfoProvider>
  )
}

function AppShell({ activeModule, onSelectModule }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar activeModule={activeModule} onSelectModule={onSelectModule} />
      <main className="flex-1 overflow-y-auto p-8">
        {activeModule === 'overview' && <OverviewModule />}
        {activeModule === 'display' && <DisplayModule />}
        {activeModule === 'touch' && <TouchModule />}
        {activeModule === 'keyboard' && <KeyboardModule />}
        {activeModule === 'audio' && <AudioModule />}
        {activeModule === 'battery' && <BatteryModule />}
        {activeModule === 'disk' && <DiskModule />}
        {activeModule === 'ports' && <PortsModule />}
        {activeModule === 'otherDevices' && <OtherDevicesModule />}
        {activeModule === 'users' && <UsersModule />}
      </main>
    </div>
  )
}
