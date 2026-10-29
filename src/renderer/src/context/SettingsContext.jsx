import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { applyPalette } from '@/lib/palette'

const SettingsContext = createContext(null)

/** App settings, stored by the main process (theme and backdrop apply there). */
export function SettingsProvider({ initialSettings, onChange, children }) {
  const [settings, setSettings] = useState(initialSettings)
  // Colors are applied here; the theme and backdrop by the main process
  useEffect(() => {
    onChange?.(settings)
    applyPalette(settings)
  }, [settings, onChange])
  const updateSetting = useCallback(async (key, value) => {
    // Show the change right away; the main process confirms what it stored
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSettings(await window.api.updateSettings({ [key]: value }))
  }, [])
  const resetSettings = useCallback(async () => {
    setSettings(await window.api.resetSettings())
  }, [])
  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
