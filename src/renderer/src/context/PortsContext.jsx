import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const HIGHLIGHT_MS = 4e3
export const PortsContext = createContext(null)
export function PortsProvider({ children }) {
  const [snapshot, setSnapshot] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [recentlyConnected, setRecentlyConnected] = useState({})
  const knownIdsRef = useRef(null)
  const hasLoadedOnce = useRef(false)
  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const next = await window.api.getPortsSnapshot()
      const nextIds = new Set(next.usbDevices.map((d) => d.id))
      if (knownIdsRef.current) {
        const newlyPlugged = [...nextIds].filter((id) => !knownIdsRef.current?.has(id))
        if (newlyPlugged.length > 0) {
          const now = Date.now()
          setRecentlyConnected((prev) => {
            const updated = {
              ...prev
            }
            for (const id of newlyPlugged) updated[id] = now
            return updated
          })
        }
      }
      knownIdsRef.current = nextIds
      setSnapshot(next)
    } catch {
    } finally {
      setIsLoading(false)
      hasLoadedOnce.current = true
    }
  }, [])
  useEffect(() => {
    if (hasLoadedOnce.current) return
    void load()
  }, [load])
  useEffect(() => {
    if (Object.keys(recentlyConnected).length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setRecentlyConnected((prev) => {
        const updated = Object.fromEntries(
          Object.entries(prev).filter(([, ts]) => now - ts < HIGHLIGHT_MS)
        )
        return Object.keys(updated).length === Object.keys(prev).length ? prev : updated
      })
    }, 500)
    return () => clearInterval(timer)
  }, [recentlyConnected])
  const refresh = useCallback(() => {
    void load()
  }, [load])
  return (
    <PortsContext.Provider
      value={{
        snapshot,
        isLoading,
        recentlyConnected,
        refresh
      }}
    >
      {children}
    </PortsContext.Provider>
  )
}

export function usePortsContext() {
  const ctx = useContext(PortsContext)
  if (!ctx) {
    throw new Error('usePortsContext must be used within a PortsProvider')
  }
  return ctx
}
