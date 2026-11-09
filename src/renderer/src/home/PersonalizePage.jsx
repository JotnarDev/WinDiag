import { useCallback, useEffect, useState } from 'react'
import {
  ArrowClockwiseRegular,
  ArrowResetRegular,
  OpenRegular,
  ShieldRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressRing, ToggleSwitch } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'
import { actionError, errorText } from './actions'

/*
 * Personalize: how Windows looks and behaves. Settings with two states use a
 * switch; the others a row of choices. Each shows Windows' own default, and
 * one button puts them all back.
 */

const GROUPS = [
  { id: 'look', title: 'Appearance' },
  { id: 'explorer', title: 'File Explorer' },
  { id: 'taskbar', title: 'Taskbar' },
  { id: 'input', title: 'Keyboard and mouse' }
]

// choices: labels for settings that aren't on/off, in the order shown
const TEXT = {
  theme: {
    title: 'Dark mode',
    text: 'Windows and the apps that follow it use dark colours.',
    choices: { light: 'Light', dark: 'Dark' }
  },
  fileExtensions: {
    title: 'Show file extensions',
    text: 'Names show their type, like “photo.jpg” or “setup.exe”, so a file can’t pass itself off as something else.'
  },
  hiddenFiles: {
    title: 'Show hidden files',
    text: 'Shows files and folders Windows and apps keep out of sight, such as AppData. Handy for fixing problems; leave them as they are.'
  },
  openToThisPc: {
    title: 'Open File Explorer to This PC',
    text: 'File Explorer starts on your drives instead of Home and its recent files.'
  },
  classicMenu: {
    title: 'Classic right-click menu',
    text: 'Right-clicking a file shows the full menu at once, without “Show more options” (Windows 11).'
  },
  taskbarAlignment: {
    title: 'Taskbar alignment',
    text: 'Where the Start button and app icons sit (Windows 11).',
    choices: { left: 'Left', center: 'Center' }
  },
  taskbarSearch: {
    title: 'Search on the taskbar',
    text: 'How search shows next to Start.',
    choices: { hidden: 'Hidden', icon: 'Icon', box: 'Search box' }
  },
  taskView: {
    title: 'Task View button',
    text: 'The button that shows your open windows and desktops. Windows key + Tab still works without it.'
  },
  widgets: {
    title: 'Widgets',
    text: 'News, weather and other widgets on the taskbar. Off: Widgets can’t be opened at all.'
  },
  endTask: {
    title: 'End task on the taskbar',
    text: 'Right-clicking an app on the taskbar can close it when it stops responding, without Task Manager (Windows 11).'
  },
  mouseAcceleration: {
    title: 'Enhance pointer precision',
    text: 'The pointer goes further when you move the mouse faster. Many gamers turn it off so the same move always lands in the same place.'
  },
  stickyKeys: {
    title: 'Sticky Keys shortcut',
    text: 'Pressing Shift five times asks to turn on Sticky Keys, which often interrupts games.'
  },
  numLock: {
    title: 'Num Lock on at startup',
    text: 'The number pad works as soon as Windows starts, also on the sign-in screen. Takes effect the next time you sign in.'
  }
}

const isSwitch = (setting) => setting.options.length === 2 && setting.options.includes('on')

/** A row of choices, like the segmented buttons in Windows Settings. */
function Choices({ setting, choices, disabled, onChoose, label }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-control border border-control-strong bg-control-alt p-0.5"
    >
      {setting.options.map((option) => {
        const active = setting.option === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChoose(option)}
            className={cn(
              'rounded-[3px] px-3 py-1 transition-colors disabled:pointer-events-none',
              active ? 'bg-accent-fill font-semibold text-text-on-accent' : 'hover:bg-subtle-hover',
              disabled && !active && 'text-text-disabled'
            )}
          >
            {choices[option] ?? option}
          </button>
        )
      })}
    </div>
  )
}

function defaultLabel(setting, text) {
  if (text.choices) return text.choices[setting.defaultOption]
  return setting.defaultOption === 'on' ? 'On' : 'Off'
}

export function PersonalizePage() {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [problem, setProblem] = useState(null)
  const [explorerPending, setExplorerPending] = useState(false)
  const [hasBattery, setHasBattery] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSettings(await window.api.getPersonalizeSettings())
    } catch (err) {
      setSettings([])
      setError(errorText(err, 'Couldn’t read the settings.'))
    }
  }, [])

  useEffect(() => {
    load()
    window.api
      .runCheckup('battery')
      .then((r) => setHasBattery(Boolean(r?.hasBattery)))
      .catch(() => {})
  }, [load])

  const apply = async (changes, busyKey) => {
    if (changes.length === 0) return
    setBusy(busyKey)
    setProblem(null)
    const result = await window.api
      .setPersonalizeSettings(changes)
      .catch((err) => ({ ok: false, error: errorText(err) }))
    const failure = actionError(result)
    if (failure) setProblem(failure)
    if (!failure && changes.some((c) => settings.find((s) => s.id === c.id)?.explorer))
      setExplorerPending(true)
    await load()
    setBusy(null)
  }

  const known = (settings ?? []).filter((s) => TEXT[s.id])
  const changed = known.filter((s) => s.option !== s.defaultOption)

  return (
    <Page
      title="Personalize"
      description="Make Windows look and work the way you like. Everything here can be set back."
    >
      {error ? (
        <InfoBar severity="warning" title="Couldn’t read the settings">
          {error}
        </InfoBar>
      ) : settings === null ? (
        <Card className="flex items-center gap-3 p-5 text-text-secondary">
          <ProgressRing /> Reading your settings…
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="font-brand text-[18px] leading-snug font-semibold">
                {changed.length === 0
                  ? 'Everything is as Windows comes.'
                  : `${changed.length} of ${known.length} settings differ from how Windows comes.`}
              </p>
              <p className="text-text-secondary">
                Changes apply right away. Some taskbar and File Explorer ones show after File
                Explorer restarts.
              </p>
            </div>
            <Button
              icon={ArrowResetRegular}
              disabled={busy !== null || changed.length === 0}
              onClick={() =>
                apply(
                  changed.map((s) => ({ id: s.id, option: s.defaultOption })),
                  'all'
                )
              }
            >
              Restore Windows defaults
            </Button>
          </Card>

          {busy === 'all' && (
            <p className="-mt-3 inline-flex items-center gap-2 text-text-secondary">
              <ProgressRing /> Applying… Windows may ask for permission.
            </p>
          )}
          {problem && (
            <InfoBar severity="warning" title="Some settings didn’t change" className="-mt-3">
              {problem}
            </InfoBar>
          )}
          {explorerPending && (
            <InfoBar
              severity="info"
              title="The taskbar and File Explorer update after File Explorer restarts"
              className="-mt-3"
              action={
                <Button
                  icon={ArrowClockwiseRegular}
                  onClick={() => {
                    setExplorerPending(false)
                    void window.api.restartExplorer()
                  }}
                >
                  Restart File Explorer
                </Button>
              }
            >
              Your open windows stay open; the taskbar disappears for a moment.
            </InfoBar>
          )}

          {GROUPS.map((group) => {
            const items = known.filter((s) => s.group === group.id)
            if (items.length === 0) return null
            return (
              <section key={group.id}>
                <h2 className="mb-2 font-brand text-subtitle font-semibold">{group.title}</h2>
                <Card className="divide-y divide-card-stroke">
                  {items.map((setting) => {
                    const text = TEXT[setting.id]
                    return (
                      <div
                        key={setting.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-semibold">
                            {text.title}
                            {setting.option === null && <Badge tone="neutral">Custom</Badge>}
                          </p>
                          <p className="text-text-secondary">{text.text}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-secondary">
                            <span>Windows default: {defaultLabel(setting, text)}</span>
                            {setting.admin && (
                              <span className="inline-flex items-center gap-1">
                                <ShieldRegular aria-hidden className="size-3.5" />
                                Asks for permission
                              </span>
                            )}
                          </p>
                        </div>
                        {busy === setting.id ? (
                          <ProgressRing label={`Changing ${text.title}`} />
                        ) : isSwitch(setting) ? (
                          <ToggleSwitch
                            checked={setting.option === 'on'}
                            disabled={busy !== null}
                            onChange={(on) =>
                              apply([{ id: setting.id, option: on ? 'on' : 'off' }], setting.id)
                            }
                            label={text.title}
                          />
                        ) : (
                          <Choices
                            setting={setting}
                            choices={text.choices ?? {}}
                            label={text.title}
                            disabled={busy !== null}
                            onChoose={(option) => apply([{ id: setting.id, option }], setting.id)}
                          />
                        )}
                      </div>
                    )
                  })}
                  {group.id === 'taskbar' && hasBattery && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">Battery percentage</p>
                        <p className="text-text-secondary">
                          Show how much battery is left next to the battery icon. Turn it on in
                          Power &amp; battery settings (recent Windows 11).
                        </p>
                      </div>
                      <Button
                        icon={OpenRegular}
                        onClick={() => window.api.openWindowsPage('power')}
                      >
                        Power &amp; battery
                      </Button>
                    </div>
                  )}
                </Card>
              </section>
            )
          })}
          <p className="text-caption text-text-secondary">
            Several of these follow the tweaks in Chris Titus Tech’s WinUtil (MIT licence).
          </p>
        </div>
      )}
    </Page>
  )
}
