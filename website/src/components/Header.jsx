import { DesktopRegular, WeatherMoonRegular, WeatherSunnyRegular, ArrowDownloadRegular } from '@fluentui/react-icons'
import { motion } from 'motion/react'
import { LOCALES, useI18n } from '../i18n'
import { useTheme } from '../lib/theme'
import { SITE } from '../lib/site'
import { cn } from '../lib/cn'
import { Button } from './Button'

const THEME_ICONS = { system: DesktopRegular, light: WeatherSunnyRegular, dark: WeatherMoonRegular }

/** System / Light / Dark, as a segmented control with a sliding selection. */
function ThemeSwitch() {
  const { t } = useI18n()
  const { pref, setPref, prefs } = useTheme()
  return (
    <div role="radiogroup" aria-label={t('nav.theme')} className="flex rounded-[6px] bg-stage p-1">
      {prefs.map((id) => {
        const Icon = THEME_ICONS[id]
        const active = pref === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(`nav.themes.${id}`)}
            onClick={() => setPref(id)}
            className={cn(
              'relative flex size-9 items-center justify-center rounded-[4px] transition-colors duration-200',
              active ? 'text-ink' : 'text-muted hover:text-ink'
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                className="absolute inset-0 rounded-[4px] bg-raise"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <Icon fontSize={18} className="relative" />
            <span className="sr-only">{t(`nav.themes.${id}`)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Only rendered once a second language is marked ready in i18n/index.jsx. */
function LanguageSwitch() {
  const { t, locale, setLocale, available } = useI18n()
  if (available.length < 2) return null
  return (
    <label className="flex items-center">
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="h-11 rounded-[6px] bg-stage px-3 text-[15px] text-ink"
      >
        {available.map((code) => (
          <option key={code} value={code}>
            {LOCALES[code].label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Header() {
  const { t } = useI18n()
  const links = ['tests', 'tools', 'drivers', 'faq']
  return (
    <header className="sticky top-0 z-40 bg-bg transition-colors duration-500">
      <a
        href="#main"
        className="absolute left-4 top-2 -translate-y-20 rounded-[4px] bg-accent px-4 py-2 text-on-accent focus:translate-y-0"
      >
        {t('nav.skip')}
      </a>
      <div className="frame flex h-16 items-center gap-6">
        <a href="#top" className="flex shrink-0 items-center gap-2.5 text-[19px] font-semibold tracking-[-0.01em]">
          <img src="./app-icon.png" alt="" width="28" height="28" className="size-7" />
          WinDiag
        </a>
        <nav aria-label="Main" className="ml-6 hidden items-center gap-7 lg:flex">
          {links.map((id) => (
            <a key={id} href={`#${id}`} className="text-[16px] text-muted transition-colors hover:text-ink">
              {t(`nav.${id}`)}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitch />
          <ThemeSwitch />
          <div className="hidden sm:block">
            <Button href={SITE.download}>
              <ArrowDownloadRegular fontSize={18} />
              {t('nav.download')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
