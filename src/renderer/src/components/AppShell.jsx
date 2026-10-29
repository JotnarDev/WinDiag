import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Battery6Regular,
  DesktopRegular,
  DeveloperBoardSearchRegular,
  HardDriveRegular,
  HomeRegular,
  KeyboardMouseRegular,
  NavigationRegular,
  PeopleRegular,
  SettingsRegular,
  ShieldKeyholeRegular,
  Speaker2Regular,
  TapSingleRegular,
  UsbPlugRegular,
  Wifi1Regular,
  WrenchScrewdriverRegular
} from '@fluentui/react-icons'
import appIcon from '@/assets/app-icon.png'
import { ProgressRing } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'

export const NAV_GROUPS = [
  {
    items: [{ id: 'overview', label: 'Overview', icon: HomeRegular }]
  },
  {
    header: 'Hardware tests',
    items: [
      { id: 'display', label: 'Display', icon: DesktopRegular },
      { id: 'touch', label: 'Touch', icon: TapSingleRegular },
      { id: 'keyboard', label: 'Keyboard & mouse', icon: KeyboardMouseRegular },
      { id: 'audio', label: 'Audio & camera', icon: Speaker2Regular },
      { id: 'battery', label: 'Battery', icon: Battery6Regular },
      { id: 'disk', label: 'Disk health', icon: HardDriveRegular },
      { id: 'ports', label: 'USB ports', icon: UsbPlugRegular },
      { id: 'otherDevices', label: 'Wireless & peripherals', icon: Wifi1Regular }
    ]
  },
  {
    header: 'Tools',
    items: [
      { id: 'tools', label: 'Technician tools', icon: WrenchScrewdriverRegular },
      { id: 'drivers', label: 'Drivers', icon: DeveloperBoardSearchRegular },
      { id: 'users', label: 'Users', icon: PeopleRegular }
    ]
  }
]

// Pinned to the bottom of the pane, like Settings in WinUI's NavigationView
const SETTINGS_ITEM = { id: 'settings', label: 'Settings', icon: SettingsRegular }

// NavigationView's adaptive breakpoint: below it the pane collapses to icons
// and opens as an overlay instead of pushing the content aside
const EXPANDED_MIN_WIDTH = 1008
const PANE_WIDTH = 280
const COMPACT_WIDTH = 48
const PANE_PREF_KEY = 'windiag.paneOpen'

function readPanePref() {
  try {
    return localStorage.getItem(PANE_PREF_KEY) !== 'false'
  } catch {
    return true
  }
}

function useWideWindow() {
  const query = `(min-width: ${EXPANDED_MIN_WIDTH}px)`
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setWide(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return wide
}

function TitleBar({ height, onTogglePane, paneOpen, isElevated }) {
  return (
    <header
      className="app-drag flex shrink-0 items-center gap-1 pl-1"
      // Leave room for the caption buttons Windows draws on the right
      style={{ height, paddingRight: 'calc(100vw - env(titlebar-area-width, 100vw))' }}
    >
      <button
        type="button"
        onClick={onTogglePane}
        aria-label={paneOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={paneOpen}
        className="app-no-drag flex h-9 w-10 items-center justify-center rounded-control hover:bg-subtle-hover active:bg-subtle-pressed"
      >
        <NavigationRegular aria-hidden className="size-4" />
      </button>
      <img src={appIcon} alt="" className="ml-2 size-4" draggable={false} />
      <span className="ml-3 truncate text-caption">
        {isElevated ? 'Administrator: WinDiag' : 'WinDiag'}
      </span>
    </header>
  )
}

function NavItem({ item, selected, showLabel, onSelect }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={selected ? 'page' : undefined}
      title={showLabel ? undefined : item.label}
      className={cn(
        'relative flex h-9 w-full items-center gap-4 rounded-control px-3 text-left text-body transition-colors duration-100',
        selected ? 'bg-subtle-hover' : 'hover:bg-subtle-hover active:bg-subtle-pressed'
      )}
    >
      {selected && (
        <span className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent-fill" />
      )}
      <Icon aria-hidden className="size-4 shrink-0" />
      {showLabel && <span className="truncate">{item.label}</span>}
    </button>
  )
}

function RunAsAdminItem({ showLabel }) {
  const [relaunching, setRelaunching] = useState(false)
  const [error, setError] = useState(null)
  const handleClick = useCallback(async () => {
    setRelaunching(true)
    setError(null)
    const result = await window.api.relaunchAsAdmin()
    if (!result.success) {
      setError(result.message)
      setRelaunching(false)
    }
  }, [])
  return (
    <div>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={relaunching}
        title={showLabel ? undefined : 'Run as administrator'}
        className="flex h-9 w-full items-center gap-4 rounded-control px-3 text-left text-body hover:bg-subtle-hover active:bg-subtle-pressed disabled:text-text-disabled"
      >
        {relaunching ? (
          <ProgressRing size={16} label="Relaunching" />
        ) : (
          <ShieldKeyholeRegular aria-hidden className="size-4 shrink-0 text-caution" />
        )}
        {showLabel && (
          <span className="truncate">{relaunching ? 'Relaunching…' : 'Run as administrator'}</span>
        )}
      </button>
      {error && showLabel && (
        <p role="alert" className="px-3 pt-1 text-caption text-critical">
          {error}
        </p>
      )}
    </div>
  )
}

function NavPane({ activeModule, onSelect, showLabels, isElevated }) {
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-1 pb-2">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.header ?? index} className="flex flex-col gap-1">
            {group.header &&
              (showLabels ? (
                <div className="px-3 pt-4 pb-1 text-body font-semibold">{group.header}</div>
              ) : (
                <div className="mx-2 my-1 h-px bg-divider" />
              ))}
            {group.items.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                selected={item.id === activeModule}
                showLabel={showLabels}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1 px-1 pb-2">
        {isElevated === false && <RunAsAdminItem showLabel={showLabels} />}
        <NavItem
          item={SETTINGS_ITEM}
          selected={activeModule === SETTINGS_ITEM.id}
          showLabel={showLabels}
          onSelect={onSelect}
        />
        {showLabels && (
          <p className="px-3 pt-1 text-caption text-text-tertiary">
            Version {__APP_VERSION__} · Beta by JOTNAR
          </p>
        )}
      </div>
    </nav>
  )
}

/**
 * Windows 11 app frame: custom title bar over Mica, NavigationView on the
 * left (expanded, compact or overlay depending on the window width) and the
 * page on a content layer with a rounded top-left corner.
 */
export function AppShell({ activeModule, onSelectModule, titleBarHeight, children }) {
  const wide = useWideWindow()
  const [panePref, setPanePref] = useState(readPanePref)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [isElevated, setIsElevated] = useState(null)
  const contentRef = useRef(null)
  useEffect(() => {
    void window.api.isElevated().then(setIsElevated)
  }, [])
  useEffect(() => {
    if (wide) setOverlayOpen(false)
  }, [wide])
  // Light dismiss for the overlay pane
  useEffect(() => {
    if (!overlayOpen) return
    const handleKey = (event) => {
      if (event.key === 'Escape') setOverlayOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [overlayOpen])
  const paneOpen = wide ? panePref : overlayOpen
  const togglePane = () => {
    if (wide) {
      setPanePref((open) => {
        try {
          localStorage.setItem(PANE_PREF_KEY, String(!open))
        } catch {
          // not remembered, that's fine
        }
        return !open
      })
    } else {
      setOverlayOpen((open) => !open)
    }
  }
  const handleSelect = (id) => {
    onSelectModule(id)
    setOverlayOpen(false)
    // New page starts at the top, and keyboard users land in it
    contentRef.current?.scrollTo({ top: 0 })
    contentRef.current?.focus({ preventScroll: true })
  }
  const inlineWidth = wide && panePref ? PANE_WIDTH : COMPACT_WIDTH
  return (
    <div className="flex h-full flex-col">
      <TitleBar
        height={titleBarHeight}
        onTogglePane={togglePane}
        paneOpen={paneOpen}
        isElevated={isElevated}
      />
      <div className="relative flex min-h-0 flex-1">
        <div className="shrink-0 transition-[width] duration-200" style={{ width: inlineWidth }}>
          <NavPane
            activeModule={activeModule}
            onSelect={handleSelect}
            showLabels={wide && panePref}
            isElevated={isElevated}
          />
        </div>
        {overlayOpen && (
          <>
            <div className="absolute inset-0 z-30" onClick={() => setOverlayOpen(false)} />
            <div
              className="absolute top-0 bottom-0 left-0 z-40 rounded-r-overlay border-r border-card-stroke bg-flyout pt-1 shadow-flyout"
              style={{ width: PANE_WIDTH }}
            >
              <NavPane
                activeModule={activeModule}
                onSelect={handleSelect}
                showLabels
                isElevated={isElevated}
              />
            </div>
          </>
        )}
        <main
          ref={contentRef}
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto rounded-tl-overlay border-t border-l border-card-stroke bg-layer pt-6 focus-visible:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
