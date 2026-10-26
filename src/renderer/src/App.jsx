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
import { FansModule } from '@/modules/FansModule'

export function App() {
  return (
    // Both providers live above the tab switcher below, so neither unmounts
    // when the active module changes: the hardware snapshot and live
    // readings (dashboard, battery) and the ports snapshot both persist
    // across tab switches instead of being re-fetched every time.
    <SystemInfoProvider>
      <PortsProvider>
        <AppShell />
      </PortsProvider>
    </SystemInfoProvider>
  )
}

function AppShell() {
  const [activeModule, setActiveModule] = useState('overview')
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar activeModule={activeModule} onSelectModule={setActiveModule} />
      <main className="flex-1 overflow-y-auto p-8">
        {activeModule === 'overview' && <OverviewModule />}
        {activeModule === 'display' && <DisplayModule />}
        {activeModule === 'touch' && <TouchModule />}
        {activeModule === 'keyboard' && <KeyboardModule />}
        {activeModule === 'audio' && <AudioModule />}
        {activeModule === 'battery' && <BatteryModule />}
        {activeModule === 'disk' && <DiskModule />}
        {activeModule === 'fans' && <FansModule />}
        {activeModule === 'ports' && <PortsModule />}
        {activeModule === 'otherDevices' && <OtherDevicesModule />}
        {activeModule === 'users' && <UsersModule />}
      </main>
    </div>
  )
}
