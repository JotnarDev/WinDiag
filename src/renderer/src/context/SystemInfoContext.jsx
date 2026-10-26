import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const MAX_BATTERY_SAMPLES = 60
// Live readings refresh quickly only while a screen that shows them is open;
// otherwise a slow background poll keeps the battery history going. Nothing
// is polled while the window is minimized or hidden.
const LIVE_POLL_MS = 5e3
const BACKGROUND_POLL_MS = 30e3
export const SystemInfoContext = createContext(null)
export function SystemInfoProvider({ children, live = false }) {
  const liveRef = useRef(live)
  liveRef.current = live
  const pollNowRef = useRef(null)
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
    function schedule() {
      if (cancelled) return
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(
        () => pollNowRef.current?.(),
        liveRef.current ? LIVE_POLL_MS : BACKGROUND_POLL_MS
      )
    }
    async function fetchDynamic() {
      timeoutId = null
      if (document.hidden) {
        schedule()
        return
      }
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
        schedule()
      }
    }
    let inFlight = null
    pollNowRef.current = () => {
      if (inFlight || cancelled) return
      if (timeoutId) clearTimeout(timeoutId)
      inFlight = fetchDynamic().finally(() => (inFlight = null))
    }
    function handleVisibilityChange() {
      if (!document.hidden) pollNowRef.current?.()
    }
    pollNowRef.current()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
  // Switching to a live screen refreshes right away instead of waiting out
  // the slow background interval.
  useEffect(() => {
    if (live) pollNowRef.current?.()
  }, [live])
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
