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
    <nav aria-hidden="true" className="flex shrink-0 flex-col gap-0.5 px-1 pb-3 md:w-[236px]">
      {NAV_GROUPS.map((group, g) => (
        <div key={g} className="flex flex-col gap-0.5">
          {group.header && (
            <>
              <div className="hidden px-3 pb-1 pt-3 text-[13px] font-semibold md:block">{t(`overview.groups.${group.header}`)}</div>
              <div className="mx-2 my-1 h-px bg-control-stroke md:hidden" />
            </>
          )}
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
              <span className="hidden truncate md:inline">{t(`overview.nav.${id}`)}</span>
            </span>
          ))}
        </div>
      ))}
    </nav>
  )
}

function Expander({ id, row, open, onToggle }) {
  const Icon = ROW_ICONS[id]
  return (
    <div className="rounded-[4px] border border-card-stroke bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[64px] w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-control-hover"
      >
        <Icon fontSize={20} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px]">{row.title}</span>
          <span className="block truncate text-[12px] text-ui-text-2">{row.summary}</span>
        </span>
        {row.action && (
          <span className="hidden h-8 items-center rounded-[4px] px-3 text-[13px] sm:inline-flex">{row.action}</span>
        )}
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
            <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-0.5 border-t border-card-stroke px-4 py-3 sm:grid-cols-[minmax(110px,auto)_1fr] sm:gap-y-1.5 sm:pl-[52px] text-[13px]">
              {row.details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ui-text-2">{label}</dt>
                  <dd className="tabular m-0 mb-1.5 min-w-0 break-words sm:mb-0">{value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * WinDiag's Overview page, built in HTML as a full window: the spec sheet of a
 * sample laptop. Each row opens like the app's expanders.
 */
export function OverviewFragment() {
  const { t } = useI18n()
  const rows = t('overview.rows')
  const [open, setOpen] = useState('cpu')

  return (
    // A Windows 11 window casts its own shadow: this is the app's window, not page decoration
    <div
      data-ui
      className="w-full overflow-hidden rounded-[8px] border border-card-stroke bg-bg text-ui-text shadow-[0_32px_64px_rgb(0_0_0/0.14),0_2px_21px_rgb(0_0_0/0.1)] dark:shadow-[0_32px_64px_rgb(0_0_0/0.5),0_2px_21px_rgb(0_0_0/0.4)]" /* taste-skill-ignore */
    >
      {/* Title bar */}
      <div className="flex h-10 items-center gap-1 pl-1 pr-4">
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

      <div className="flex h-[min(640px,78svh)]">
        <NavPane t={t} />

        {/* Page: WinUI's content layer has a 1px stroke on its top-left edge */}
        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-tl-[8px] border-l border-t border-card-stroke bg-raise px-4 py-5 sm:px-9 sm:py-7" /* taste-skill-ignore */>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
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

          {/* The device card */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[8px] border border-card-stroke bg-card px-5 py-5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-[8px] bg-subtle-hover">
              <LaptopRegular fontSize={32} className="text-accent" />
            </span>
            <div className="min-w-[200px] flex-1 text-[13px]">
              <p className="text-[20px] font-semibold leading-snug">{t('overview.device.name')}</p>
              <p className="text-ui-text-2">
                {t('overview.device.modelIdLabel')} <span className="text-ui-text">{t('overview.device.modelId')}</span>
              </p>
              <p className="text-ui-text-2">
                {t('overview.device.serialLabel')} <span className="tabular text-ui-text">{t('overview.device.serial')}</span>
              </p>
            </div>
            <div className="flex flex-col items-start gap-1 text-[13px] sm:items-end">
              <span className="text-ui-text-2">{t('overview.device.os')}</span>
              <Badge>{t('overview.activated')}</Badge>
            </div>
          </div>

          <h4 className="mb-2 mt-7 text-[14px] font-semibold tracking-normal">{t('overview.specs')}</h4>
          <div className="flex flex-col gap-1">
            {Object.entries(rows).map(([id, row]) => (
              <Expander key={id} id={id} row={row} open={open === id} onToggle={() => setOpen(open === id ? null : id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
