import { useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { SettingsProvider } from '@/context/SettingsContext'
import { SystemInfoProvider } from '@/context/SystemInfoContext'
import { TestResultsProvider } from '@/context/TestResultsContext'
import { EDITION } from '@/editions'

export function App({ titleBarHeight, micaSupported, initialSettings, onSettingsChange }) {
  const [activeModule, setActiveModule] = useState(() =>
    EDITION.modules[initialSettings.startPage] ? initialSettings.startPage : 'overview'
  )
  const ActiveModule = EDITION.modules[activeModule]
  return (
    // The providers live above the page switcher, so they don't unmount when
    // the active page changes: the hardware snapshot and live readings
    // persist across pages instead of being re-fetched every time.
    <SettingsProvider initialSettings={initialSettings} onChange={onSettingsChange}>
      <SystemInfoProvider live={EDITION.liveModules.has(activeModule)}>
        <TestResultsProvider>
          <AppShell
            activeModule={activeModule}
            onSelectModule={setActiveModule}
            titleBarHeight={titleBarHeight}
          >
            <ActiveModule onNavigate={setActiveModule} micaSupported={micaSupported} />
          </AppShell>
        </TestResultsProvider>
      </SystemInfoProvider>
    </SettingsProvider>
  )
}
