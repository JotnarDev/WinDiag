import { DesktopRegular, WeatherMoonRegular, WeatherSunnyRegular, ArrowDownloadRegular } from '@fluentui/react-icons'
import { motion } from 'motion/react'
import { useCopy } from '../copy'
import { useTheme } from '../lib/theme'
import { SITE } from '../lib/site'
import { cn } from '../lib/cn'
import { Button } from './Button'
import { LogoSymbol, Wordmark } from './Logo'

const THEME_ICONS = { system: DesktopRegular, light: WeatherSunnyRegular, dark: WeatherMoonRegular }

/** System / Light / Dark, as a segmented control with a sliding selection. */
function ThemeSwitch() {
  const { t } = useCopy()
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

export function Header() {
  const { t } = useCopy()
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
        <a href="#top" aria-label="WinDiag" className="flex shrink-0 items-center gap-2.5">
          <LogoSymbol className="size-8" />
          <Wordmark className="h-[22px] w-auto translate-y-[3px]" />
        </a>
        <nav aria-label="Main" className="ml-6 hidden items-center gap-7 lg:flex">
          {links.map((id) => (
            <a key={id} href={`#${id}`} className="text-[16px] text-muted transition-colors hover:text-ink">
              {t(`nav.${id}`)}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
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
