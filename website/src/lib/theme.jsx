import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const KEY = 'windiag-site-theme'
const PREFS = ['system', 'light', 'dark']
const ThemeContext = createContext(null)

function readPref() {
  try {
    const saved = localStorage.getItem(KEY)
    return PREFS.includes(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** Light, dark or "follow the system", saved per visitor and applied to <html data-theme>. */
export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState(readPref)
  const [resolved, setResolved] = useState(() => document.documentElement.dataset.theme || 'light')

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const next = pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref
      document.documentElement.dataset.theme = next
      setResolved(next)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [pref])

  const setPref = useCallback((next) => {
    setPrefState(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Private windows may refuse storage; the choice still applies to this visit
    }
  }, [])

  return <ThemeContext.Provider value={{ pref, setPref, resolved, prefs: PREFS }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
