import { useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { PortsProvider } from '@/context/PortsContext'
import { SystemInfoProvider } from '@/context/SystemInfoContext'
import { AudioModule } from '@/modules/AudioModule'
import { BateriaModule } from '@/modules/BateriaModule'
import { DiscoModule } from '@/modules/DiscoModule'
import { OtrosModule } from '@/modules/OtrosModule'
import { PantallaModule } from '@/modules/PantallaModule'
import { PuertosModule } from '@/modules/PuertosModule'
import { ResumenModule } from '@/modules/ResumenModule'
import { TactilModule } from '@/modules/TactilModule'
import { TecladoModule } from '@/modules/TecladoModule'
import { UsuariosModule } from '@/modules/UsuariosModule'
import { VentiladoresModule } from '@/modules/VentiladoresModule'

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
  const [activeModule, setActiveModule] = useState('resumen')
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar activeModule={activeModule} onSelectModule={setActiveModule} />
      <main className="flex-1 overflow-y-auto p-8">
        {activeModule === 'resumen' && <ResumenModule />}
        {activeModule === 'pantalla' && <PantallaModule />}
        {activeModule === 'tactil' && <TactilModule />}
        {activeModule === 'teclado' && <TecladoModule />}
        {activeModule === 'audio' && <AudioModule />}
        {activeModule === 'bateria' && <BateriaModule />}
        {activeModule === 'disco' && <DiscoModule />}
        {activeModule === 'ventiladores' && <VentiladoresModule />}
        {activeModule === 'puertos' && <PuertosModule />}
        {activeModule === 'otros' && <OtrosModule />}
        {activeModule === 'usuarios' && <UsuariosModule />}
      </main>
    </div>
  )
}
