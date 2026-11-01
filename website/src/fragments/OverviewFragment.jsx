import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowSyncRegular,
  Battery6Regular,
  ChevronDownRegular,
  CopyRegular,
  DesktopRegular,
  DeveloperBoardLightningRegular,
  DeveloperBoardRegular,
  DeveloperBoardSearchRegular,
  HardDriveRegular,
  HomeRegular,
  KeyboardMouseRegular,
  LaptopRegular,
  NavigationRegular,
  PeopleRegular,
  RamRegular,
  SettingsRegular,
  Speaker2Regular,
  StorageRegular,
  TapSingleRegular,
  UsbPlugRegular,
  Wifi1Regular,
  WindowRegular,
  WrenchScrewdriverRegular
} from '@fluentui/react-icons'
import { useI18n } from '../i18n'
import { cn } from '../lib/cn'
import { EASE } from '../lib/motion'
import { UiButton } from './ui'

// The app's NavigationView, in its own order (AppShell.jsx in the app)
const NAV_GROUPS = [
  { items: [['overview', HomeRegular]] },
  {
    header: 'tests',
    items: [
      ['display', DesktopRegular],
      ['touch', TapSingleRegular],
      ['keyboard', KeyboardMouseRegular],
      ['audio', Speaker2Regular],
      ['battery', Battery6Regular],
      ['disk', HardDriveRegular],
      ['ports', UsbPlugRegular],
      ['wireless', Wifi1Regular]
    ]
  },
  {
    header: 'tools',
    items: [
      ['tools', WrenchScrewdriverRegular],
      ['drivers', DeveloperBoardSearchRegular],
      ['users', PeopleRegular]
    ]
  }
]

// One icon per row of the spec sheet, keyed like overview.rows in the locale
const ROW_ICONS = {
  cpu: DeveloperBoardRegular,
  memory: RamRegular,
  storage: StorageRegular,
  graphics: DeveloperBoardLightningRegular,
  battery: Battery6Regular,
  bios: SettingsRegular,
  windows: WindowRegular
}

function Badge({ children }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-success-bg px-2 text-[12px] text-success">
      {children}
    </span>
  )
}

function NavPane({ t }) {
  return (
    <nav aria-hidden="true" className="flex w-[236px] shrink-0 flex-col gap-0.5 px-1 pb-3">
      {NAV_GROUPS.map((group, g) => (
        <div key={g} className="flex flex-col gap-0.5">
          {group.header && <div className="px-3 pb-1 pt-3 text-[13px] font-semibold">{t(`overview.groups.${group.header}`)}</div>}
          {group.items.map(([id, Icon]) => (
            <span
              key={id}
              className={cn(
                'relative flex h-9 items-center gap-4 rounded-[4px] px-3 text-[13px]',
                id === 'overview' && 'bg-subtle-hover'
              )}
            >
              {id === 'overview' && <span className="absolute left-0 h-4 w-[3px] rounded-full bg-accent" />}
              <Icon fontSize={16} className="shrink-0" />
              <span className="truncate">{t(`overview.nav.${id}`)}</span>
            </span>
          ))}
        </div>
      ))}
    </nav>
  )
}

function Expander({ id, row, open, onToggle, interactive }) {
  const Icon = ROW_ICONS[id]
  return (
    <div className="rounded-[4px] border border-card-stroke bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        tabIndex={interactive ? 0 : -1}
        className="flex min-h-[64px] w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-control-hover"
      >
        <Icon fontSize={20} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px]">{row.title}</span>
          <span className="block truncate text-[12px] text-ui-text-2">{row.summary}</span>
        </span>
        {row.action && <span className="inline-flex h-8 items-center rounded-[4px] px-3 text-[13px]">{row.action}</span>}
        {row.badge && <Badge>{row.badge}</Badge>}
        <ChevronDownRegular
          fontSize={14}
          className={cn('shrink-0 transition-transform duration-300', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <dl className="m-0 grid grid-cols-[minmax(110px,auto)_1fr] gap-x-6 gap-y-1.5 border-t border-card-stroke px-4 py-3 pl-[52px] text-[13px]">
              {row.details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ui-text-2">{label}</dt>
                  <dd className="tabular m-0 min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin text-accent" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="28 41" />
    </svg>
  )
}

// Blocks of the page come in one after another once the components are read
const reveal = (i) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE, delay: i * 0.08 }
})

/** The window's size in CSS pixels; the laptop scales it to fit its screen. */
export const WINDOW_SIZE = { width: 1120, height: 700 }

/**
 * WinDiag's Overview page as a maximized window: the spec sheet of a sample
 * laptop. `phase` is 'reading' while it "reads the components", then 'ready'.
 * Rows open like the app's expanders when `interactive`.
 */
export function OverviewFragment({ phase = 'ready', interactive = true }) {
  const { t } = useI18n()
  const rows = t('overview.rows')
  const [open, setOpen] = useState('cpu')

  return (
    <div data-ui className="flex flex-col bg-bg text-ui-text" style={WINDOW_SIZE}>
      {/* Title bar */}
      <div className="flex h-10 shrink-0 items-center gap-1 pl-1 pr-4">
        <span className="flex h-9 w-10 items-center justify-center" aria-hidden="true">
          <NavigationRegular fontSize={16} />
        </span>
        <img src="./app-icon.png" alt="" width="16" height="16" className="ml-2 size-4" />
        <span className="ml-3 text-[12px]">{t('overview.window')}</span>
        <span className="ml-auto flex items-center gap-5 text-ui-text-2" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" /></svg>
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" rx="1.5" /></svg>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" /></svg>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <NavPane t={t} />

        {/* Page: WinUI's content layer has a 1px stroke on its top-left edge. No
            scrolling of its own, so a finger on it always scrolls the website. */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-tl-[8px] border-l border-t border-card-stroke bg-raise px-9 py-7" /* taste-skill-ignore */>
          <div className="flex items-start justify-between gap-6">
            <div>
              <h3 className="text-[26px] font-semibold leading-tight tracking-normal">{t('overview.page')}</h3>
              <p className="mt-1 text-[13px] text-ui-text-2">{t('overview.description')}</p>
            </div>
            <div className="flex gap-2">
              <UiButton tabIndex={-1}>
                <CopyRegular fontSize={16} />
                {t('overview.copy')}
              </UiButton>
              <UiButton tabIndex={-1}>
                <ArrowSyncRegular fontSize={16} />
                {t('overview.refresh')}
              </UiButton>
            </div>
          </div>

          {phase !== 'ready' ? (
            <div className="mt-6 flex items-center gap-3 rounded-[8px] border border-card-stroke bg-card px-4 py-5 text-[13px] text-ui-text-2">
              <Spinner />
              {t('overview.reading')}
            </div>
          ) : (
            <>
              {/* The device card */}
              <motion.div {...reveal(0)} className="mt-6 flex items-center gap-5 rounded-[8px] border border-card-stroke bg-card px-5 py-5">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-[8px] bg-subtle-hover">
                  <LaptopRegular fontSize={32} className="text-accent" />
                </span>
                <div className="min-w-0 flex-1 text-[13px]">
                  <p className="text-[20px] font-semibold leading-snug">{t('overview.device.name')}</p>
                  <p className="text-ui-text-2">
                    {t('overview.device.modelIdLabel')} <span className="text-ui-text">{t('overview.device.modelId')}</span>
                  </p>
                  <p className="text-ui-text-2">
                    {t('overview.device.serialLabel')} <span className="tabular text-ui-text">{t('overview.device.serial')}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-[13px]">
                  <span className="text-ui-text-2">{t('overview.device.os')}</span>
                  <Badge>{t('overview.activated')}</Badge>
                </div>
              </motion.div>

              <motion.h4 {...reveal(1)} className="mb-2 mt-7 text-[14px] font-semibold tracking-normal">
                {t('overview.specs')}
              </motion.h4>
              <div className="flex flex-col gap-1">
                {Object.entries(rows).map(([id, row], i) => (
                  <motion.div key={id} {...reveal(i + 2)}>
                    <Expander
                      id={id}
                      row={row}
                      open={open === id}
                      interactive={interactive}
                      onToggle={() => setOpen(open === id ? null : id)}
                    />
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
