import { useEffect, useRef, useState } from 'react'
import {
  ArrowResetRegular,
  BlurRegular,
  CheckmarkFilled,
  ColorRegular,
  DarkThemeRegular,
  DismissRegular,
  DocumentBulletListRegular,
  HomeRegular,
  InfoRegular,
  KeyboardRegular,
  PaintBrushRegular
} from '@fluentui/react-icons'
import appIcon from '@/assets/app-icon.png'
import { NAV_GROUPS } from '@/components/AppShell'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Expander, Section, SettingsCard } from '@/components/ui/Card'
import { Badge, ToggleSwitch } from '@/components/ui/feedback'
import { Select, TextBox } from '@/components/ui/inputs'
import { useSettings } from '@/context/SettingsContext'
import { RELEASES } from '@/lib/changelog'
import { applyPalette, getSystemAccent, PALETTES, resolvePalette } from '@/lib/palette'
import { cn } from '@/lib/utils'

const THEME_OPTIONS = [
  { value: 'system', label: 'Use system setting' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

const START_PAGES = NAV_GROUPS.flatMap((group) => group.items)

// One swatch per palette: the accent on a circle of the background tint
function PalettePicker() {
  const { settings, updateSetting } = useSettings()
  return (
    <div role="radiogroup" aria-label="Color palette" className="flex flex-wrap gap-2">
      {PALETTES.map((palette) => {
        const { accent, tint } = resolvePalette({ ...settings, palette: palette.id })
        const selected = settings.palette === palette.id
        return (
          <button
            key={palette.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => void updateSetting('palette', palette.id)}
            className={cn(
              'flex w-[72px] flex-col items-center gap-1.5 rounded-control border px-1 py-2 text-caption transition-colors duration-100',
              selected
                ? 'border-accent-fill bg-subtle-hover'
                : 'border-transparent hover:bg-subtle-hover active:bg-subtle-pressed'
            )}
          >
            <span
              aria-hidden
              className="relative flex size-8 items-center justify-center rounded-full border border-control-stroke"
              style={{ background: tint ?? 'var(--control-alt)' }}
            >
              <span
                className="flex size-5 items-center justify-center rounded-full"
                style={{ background: accent ?? getSystemAccent() }}
              >
                {selected && <CheckmarkFilled className="size-3 text-white" />}
              </span>
            </span>
            {palette.label}
          </button>
        )
      })}
    </div>
  )
}

const SAVE_DELAY_MS = 400

// Color input that previews while dragging and saves once it settles
function ColorField({ label, settingKey }) {
  const { settings, updateSetting } = useSettings()
  const [value, setValue] = useState(settings[settingKey] || '#7a8b97')
  const timer = useRef(null)
  useEffect(() => {
    if (settings[settingKey]) setValue(settings[settingKey])
  }, [settings, settingKey])
  useEffect(() => () => clearTimeout(timer.current), [])
  const handleChange = (color) => {
    setValue(color)
    applyPalette({ ...settings, [settingKey]: color })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void updateSetting(settingKey, color), SAVE_DELAY_MS)
  }
  return (
    <label className="flex items-center gap-2">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        className="h-8 w-12 cursor-pointer rounded-control border border-control-stroke bg-control p-0.5"
      />
      <span className="selectable font-mono text-caption text-text-secondary">
        {value.toUpperCase()}
      </span>
    </label>
  )
}

// "What's new": every version from CHANGELOG.md, newest first
function ReleaseNotes() {
  return (
    <ol className="flex flex-col gap-5">
      {RELEASES.map((release) => (
        <li key={release.version}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body font-semibold">Version {release.version}</h3>
            {release.version === __APP_VERSION__ && <Badge tone="accent">Current</Badge>}
            {release.date && (
              <span className="text-caption text-text-secondary">{release.date}</span>
            )}
          </div>
          {release.groups.map((group) => (
            <div key={group.title} className="mt-1.5">
              <p className="text-caption font-semibold text-text-secondary">{group.title}</p>
              <ul className="mt-0.5 list-disc pl-5">
                {group.items.map((item) => (
                  <li key={item} className="selectable">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </li>
      ))}
    </ol>
  )
}

// Path field that saves when it loses focus or on Enter, so a half-typed
// server path isn't stored on every keystroke
function CatalogPathField() {
  const { settings, updateSetting } = useSettings()
  const [text, setText] = useState(settings.driverCatalog)
  useEffect(() => setText(settings.driverCatalog), [settings.driverCatalog])
  const save = (value) => {
    const trimmed = value.trim().replace(/^"|"$/g, '')
    if (trimmed !== settings.driverCatalog) void updateSetting('driverCatalog', trimmed)
  }
  const browse = async () => {
    const chosen = await window.api.chooseDriverCatalog(settings.driverCatalog || undefined)
    if (chosen) void updateSetting('driverCatalog', chosen)
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <TextBox
        id="setting-driver-catalog"
        aria-label="Driver catalog path"
        placeholder={'\\\\server\\share\\02 Drivers\\drivers-catalog.json'}
        value={text}
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => save(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save(event.currentTarget.value)
        }}
        className="min-w-0 flex-1 basis-72"
      />
      <Button onClick={() => void browse()}>Browse…</Button>
      {settings.driverCatalog && (
        <Button
          variant="subtle"
          icon={DismissRegular}
          aria-label="Stop using a catalog"
          title="Stop using a catalog"
          onClick={() => void updateSetting('driverCatalog', '')}
        />
      )}
    </div>
  )
}

export function SettingsModule({ micaSupported }) {
  const { settings, updateSetting, resetSettings } = useSettings()
  return (
    <Page title="Settings" description="How WinDiag looks and behaves on this device.">
      <Section title="Appearance">
        <SettingsCard
          icon={DarkThemeRegular}
          title="App theme"
          description="Choose light or dark, or follow the Windows setting."
        >
          <Select
            id="setting-theme"
            aria-label="App theme"
            value={settings.theme}
            onChange={(value) => void updateSetting('theme', value)}
            className="w-52"
          >
            {THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </SettingsCard>
        <SettingsCard
          icon={BlurRegular}
          title="Transparency effects"
          description={
            micaSupported
              ? 'Let the desktop tint the window background (Mica). Turning it off can help on slower devices.'
              : 'Needs Windows 11 version 22H2 or later.'
          }
        >
          <ToggleSwitch
            label="Transparency effects"
            checked={micaSupported && settings.transparency}
            disabled={!micaSupported}
            onChange={(value) => void updateSetting('transparency', value)}
          />
        </SettingsCard>
        <SettingsCard
          icon={ColorRegular}
          title="Color palette"
          stacked
          description="Accent color for buttons, switches and selection, and a tint for the window background. Windows uses the accent chosen in Windows settings."
        >
          <PalettePicker />
        </SettingsCard>
        {settings.palette === 'custom' && (
          <>
            <SettingsCard
              icon={PaintBrushRegular}
              title="Custom accent color"
              description="Buttons, switches, links and the selected page."
            >
              <ColorField label="Custom accent color" settingKey="customAccent" />
            </SettingsCard>
            <SettingsCard
              icon={PaintBrushRegular}
              title="Custom background tint"
              description="Mixed lightly into the window background."
            >
              {settings.customTint && (
                <ColorField label="Custom background tint" settingKey="customTint" />
              )}
              <ToggleSwitch
                label="Custom background tint"
                checked={Boolean(settings.customTint)}
                onChange={(on) => void updateSetting('customTint', on ? '#7a8b97' : '')}
              />
            </SettingsCard>
          </>
        )}
      </Section>

      <Section title="Startup">
        <SettingsCard
          icon={HomeRegular}
          title="Start page"
          description="The page WinDiag opens on, e.g. a test you run on every device."
        >
          <Select
            id="setting-start-page"
            aria-label="Start page"
            value={settings.startPage}
            onChange={(value) => void updateSetting('startPage', value)}
            className="w-52"
          >
            {START_PAGES.map((page) => (
              <option key={page.id} value={page.id}>
                {page.label}
              </option>
            ))}
          </Select>
        </SettingsCard>
      </Section>

      <Section title="Tests">
        <SettingsCard
          icon={KeyboardRegular}
          title="Block system keys in the keyboard test"
          description="Windows, Print Screen, Esc, Alt+Tab and the lock keys light up but don't act while the test is in front."
        >
          <ToggleSwitch
            label="Block system keys in the keyboard test"
            checked={settings.blockSystemKeys}
            onChange={(value) => void updateSetting('blockSystemKeys', value)}
          />
        </SettingsCard>
      </Section>

      <Section title="Drivers">
        <SettingsCard
          icon={DocumentBulletListRegular}
          title="Driver catalog"
          description="A .json list of your drivers (create one on the Drivers page). When set, the Drivers page compares with it instead of reading every driver in the folder — much faster when the drivers are on a server."
        >
          <CatalogPathField />
        </SettingsCard>
      </Section>

      <Section title="About">
        <Expander
          iconNode={<img src={appIcon} alt="" className="size-5 shrink-0" draggable={false} />}
          title="WinDiag"
          description={`Version ${__APP_VERSION__} · Beta by JOTNAR · Expand to see what changed in each version`}
        >
          <ReleaseNotes />
        </Expander>
        <SettingsCard
          icon={InfoRegular}
          title="Reset settings"
          description="Restore every option on this page to its default."
        >
          <Button icon={ArrowResetRegular} onClick={() => void resetSettings()}>
            Reset
          </Button>
        </SettingsCard>
      </Section>
    </Page>
  )
}
