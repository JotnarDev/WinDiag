import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from './locales/en'
import es from './locales/es'

/*
 * Translations. Every visible string lives in ./locales/<code>.js; components
 * only call t('section.key'). To add a language: fill in its file with the
 * same keys as en.js and set ready: true below. Missing keys fall back to
 * English, and the language menu appears as soon as two locales are ready.
 */
export const LOCALES = {
  en: { label: 'English', messages: en, ready: true },
  es: { label: 'Español', messages: es, ready: false }
}

const KEY = 'windiag-site-lang'
const I18nContext = createContext(null)

const readyCodes = () => Object.keys(LOCALES).filter((code) => LOCALES[code].ready)

function initialLocale() {
  const codes = readyCodes()
  const fromUrl = new URLSearchParams(window.location.search).get('lang')
  if (codes.includes(fromUrl)) return fromUrl
  try {
    const saved = localStorage.getItem(KEY)
    if (codes.includes(saved)) return saved
  } catch {
    // Storage blocked: fall through to the browser language
  }
  const browser = (navigator.language || 'en').slice(0, 2)
  return codes.includes(browser) ? browser : 'en'
}

function lookup(messages, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), messages)
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(initialLocale)

  const t = useCallback(
    (path, vars) => {
      let value = lookup(LOCALES[locale].messages, path)
      if (value === undefined) value = lookup(en, path)
      if (value === undefined) return path
      if (typeof value === 'string' && vars) {
        return value.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match))
      }
      return value
    },
    [locale]
  )

  const setLocale = useCallback((code) => {
    if (!LOCALES[code]?.ready) return
    setLocaleState(code)
    try {
      localStorage.setItem(KEY, code)
    } catch {
      // The choice still applies to this visit
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = t('meta.title')
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'))
  }, [locale, t])

  const value = useMemo(() => ({ t, locale, setLocale, available: readyCodes() }), [t, locale, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
