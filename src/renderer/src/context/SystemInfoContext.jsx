import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const MAX_BATTERY_SAMPLES = 60
const DYNAMIC_POLL_MS = 5e3
export const SystemInfoContext = createContext(null)
export function SystemInfoProvider({ children }) {
  const [staticInfo, setStaticInfo] = useState(null)
  const [dynamicInfo, setDynamicInfo] = useState(null)
  const [batterySamples, setBatterySamples] = useState([])
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasLoadedStaticOnce = useRef(false)
  const loadStatic = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await window.api.getStaticSystemInfo()
      setStaticInfo(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
      hasLoadedStaticOnce.current = true
    }
  }, [])
  useEffect(() => {
    if (hasLoadedStaticOnce.current) return
    void loadStatic()
  }, [loadStatic])
  useEffect(() => {
    let cancelled = false
    let timeoutId = null
    async function fetchDynamic() {
      try {
        const data = await window.api.getDynamicSystemInfo()
        if (cancelled) return
        setDynamicInfo(data)
        if (data.battery.hasBattery) {
          setBatterySamples((prev) =>
            [
              ...prev,
              {
                t: Date.now(),
                percent: data.battery.percent
              }
            ].slice(-MAX_BATTERY_SAMPLES)
          )
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout(() => void fetchDynamic(), DYNAMIC_POLL_MS)
        }
      }
    }
    void fetchDynamic()
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])
  const refresh = useCallback(() => {
    void loadStatic()
  }, [loadStatic])
  return (
    <SystemInfoContext.Provider
      value={{
        staticInfo,
        dynamicInfo,
        batterySamples,
        error,
        isLoading,
        refresh
      }}
    >
      {children}
    </SystemInfoContext.Provider>
  )
}

export function useSystemInfoContext() {
  const ctx = useContext(SystemInfoContext)
  if (!ctx) {
    throw new Error('useSystemInfoContext must be used within a SystemInfoProvider')
  }
  return ctx
}
