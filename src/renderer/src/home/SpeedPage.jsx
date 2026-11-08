import { useCallback, useEffect, useState } from 'react'
import {
  ArrowClockwiseRegular,
  BroomRegular,
  FlashRegular,
  LeafOneRegular,
  OpenRegular,
  ScalesRegular,
  ShieldRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressRing, ToggleSwitch } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'
import { actionError, errorText } from './actions'

/*
 * Speed up: apps that start with Windows, temporary files and the power
 * mode. Every change here can be undone, except emptying the Recycle Bin,
 * which says so.
 */

export function formatBytes(bytes) {
  if (!bytes) return '0 MB'
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`
  const mb = bytes / 1024 ** 2
  if (mb >= 1) return `${Math.round(mb)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function SpeedPage() {
  return (
    <Page
      title="Speed up"
      description="Start faster, free up space and choose how hard your PC works."
    >
      <div className="flex flex-col gap-6">
        <StartupApps />
        <Cleanup />
        <PowerMode />
      </div>
    </Page>
  )
}

function SectionTitle({ title, description, actions }) {
  return (
    <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="font-brand text-subtitle font-semibold">{title}</h2>
        {description && <p className="text-text-secondary">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

/* --- Startup apps ---------------------------------------------------------- */

function StartupApps() {
  const [apps, setApps] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [rowErrors, setRowErrors] = useState({})

  const load = useCallback(async () => {
    setError(null)
    try {
      // Sorted once, so a row doesn't jump away when it's switched
      const list = await window.api.getStartupApps()
      setApps(
        [...list].sort(
          (a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)
        )
      )
    } catch (err) {
      setApps([])
      setError(errorText(err, 'Couldn’t read the startup apps.'))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (app, enabled) => {
    setBusy(app.id)
    setRowErrors((e) => ({ ...e, [app.id]: null }))
    const result = await window.api
      .setStartupApp(app.id, enabled)
      .catch((err) => ({ ok: false, error: errorText(err) }))
    const problem = actionError(result)
    if (problem) setRowErrors((e) => ({ ...e, [app.id]: problem }))
    else setApps((list) => list.map((a) => (a.id === app.id ? { ...a, enabled } : a)))
    setBusy(null)
  }

  const enabledCount = apps?.filter((a) => a.enabled).length ?? 0

  return (
    <section>
      <SectionTitle
        title="Apps that start with Windows"
        description={
          apps && !error
            ? `${enabledCount} of ${apps.length} start when you sign in. Fewer means a faster start.`
            : 'Each one slows down signing in a little.'
        }
        actions={
          <Button icon={ArrowClockwiseRegular} onClick={load} disabled={apps === null}>
            Refresh
          </Button>
        }
      />
      {error ? (
        <InfoBar severity="warning" title="Couldn’t read the startup apps">
          {error}
        </InfoBar>
      ) : apps === null ? (
        <Card className="flex items-center gap-3 p-5 text-text-secondary">
          <ProgressRing /> Reading the startup apps…
        </Card>
      ) : apps.length === 0 ? (
        <Card className="p-5 text-text-secondary">No apps start with Windows.</Card>
      ) : (
        <Card className="divide-y divide-card-stroke">
          {apps.map((app) => (
            <div key={app.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="truncate">{app.name}</span>
                  {app.missing && <Badge tone="caution">File missing</Badge>}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 text-caption text-text-secondary">
                  <span>{app.company ?? 'Publisher unknown'}</span>
                  {app.forEveryone && (
                    <span className="inline-flex items-center gap-1">
                      <ShieldRegular aria-hidden className="size-3.5" />
                      For every user · asks for permission
                    </span>
                  )}
                </p>
                {app.missing && (
                  <p className="text-caption text-text-secondary">
                    Left behind by an app that was removed. Turning it off is safe.
                  </p>
                )}
                {rowErrors[app.id] && (
                  <p className="text-caption text-critical">{rowErrors[app.id]}</p>
                )}
              </div>
              {busy === app.id ? (
                <ProgressRing label={`Changing ${app.name}`} />
              ) : (
                <ToggleSwitch
                  checked={app.enabled}
                  onChange={(value) => toggle(app, value)}
                  disabled={busy !== null}
                  label={`Start ${app.name} with Windows`}
                />
              )}
            </div>
          ))}
        </Card>
      )}
      <p className="mt-2 text-caption text-text-secondary">
        Turning an app off doesn’t remove it: it still opens when you start it. You can turn it back
        on here or in Task Manager.
      </p>
    </section>
  )
}

/* --- Clean up -------------------------------------------------------------- */

const CLEANUPS = [
  {
    id: 'userTemp',
    title: 'Your temporary files',
    text: 'Files apps left behind more than a day ago.',
    defaultOn: true
  },
  {
    id: 'windowsTemp',
    title: 'Windows temporary files',
    text: 'Left behind by Windows and installers. Asks for permission.',
    defaultOn: true,
    minimum: true
  },
  {
    id: 'recycleBin',
    title: 'Recycle Bin',
    text: 'Files you deleted. Emptying it can’t be undone.',
    defaultOn: false
  }
]

function Cleanup() {
  const [sizes, setSizes] = useState(null)
  const [error, setError] = useState(null)
  const [chosen, setChosen] = useState(
    () => new Set(CLEANUPS.filter((c) => c.defaultOn).map((c) => c.id))
  )
  const [running, setRunning] = useState(false)
  const [outcome, setOutcome] = useState(null)

  const scan = useCallback(async () => {
    setSizes(null)
    setError(null)
    try {
      setSizes(await window.api.scanCleanup())
    } catch (err) {
      setSizes({})
      setError(errorText(err, 'Couldn’t measure the files.'))
    }
  }, [])

  useEffect(() => {
    scan()
  }, [scan])

  const selected = CLEANUPS.filter((c) => chosen.has(c.id) && sizes?.[c.id]?.bytes > 0)
  const total = selected.reduce((sum, c) => sum + sizes[c.id].bytes, 0)

  const clean = async () => {
    setRunning(true)
    setOutcome(null)
    let freed = 0
    let skipped = 0
    const problems = []
    for (const item of selected) {
      const result = await window.api
        .runCleanup(item.id)
        .catch((err) => ({ ok: false, error: errorText(err) }))
      const problem = actionError(result)
      if (problem) problems.push(`${item.title}: ${problem}`)
      else {
        freed += result.result?.bytes ?? 0
        skipped += result.result?.skipped ?? 0
      }
    }
    setOutcome({ freed, skipped, problems })
    setRunning(false)
    scan()
  }

  return (
    <section>
      <SectionTitle
        title="Free up space"
        description="Remove files nobody needs any more."
        actions={
          <Button icon={ArrowClockwiseRegular} onClick={scan} disabled={sizes === null || running}>
            Measure again
          </Button>
        }
      />
      {error && (
        <InfoBar severity="warning" title="Couldn’t measure the files" className="mb-2">
          {error}
        </InfoBar>
      )}
      <Card>
        <ul className="divide-y divide-card-stroke">
          {CLEANUPS.map((item) => {
            const size = sizes?.[item.id]
            const empty = size && !(size.bytes > 0)
            return (
              <li key={item.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-4 px-5 py-3',
                    (empty || !size) && 'cursor-default'
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-[var(--accent-fill)]"
                    checked={chosen.has(item.id) && !empty}
                    disabled={!size || empty || running}
                    onChange={(e) =>
                      setChosen((set) => {
                        const next = new Set(set)
                        if (e.target.checked) next.add(item.id)
                        else next.delete(item.id)
                        return next
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{item.title}</span>
                    <span className="block text-caption text-text-secondary">{item.text}</span>
                  </span>
                  <span className="shrink-0 font-brand tabular-nums">
                    {sizes === null ? (
                      <ProgressRing label={`Measuring ${item.title.toLowerCase()}`} />
                    ) : !size ? (
                      '—'
                    ) : empty ? (
                      <span className="text-text-secondary">Empty</span>
                    ) : (
                      `${item.minimum ? 'At least ' : ''}${formatBytes(size.bytes)}`
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-3 border-t border-card-stroke px-5 py-4">
          <Button
            variant="accent"
            icon={BroomRegular}
            disabled={running || selected.length === 0}
            onClick={clean}
          >
            {total > 0 ? `Clean up ${formatBytes(total)}` : 'Clean up'}
          </Button>
          {running && (
            <span className="inline-flex items-center gap-2 text-text-secondary">
              <ProgressRing label="Cleaning up" /> Cleaning up…
            </span>
          )}
          <span className="flex-1" />
          <Button
            variant="subtle"
            icon={OpenRegular}
            onClick={() => window.api.launchSystemTool('diskCleanup')}
          >
            Disk Cleanup
          </Button>
          <Button
            variant="subtle"
            icon={OpenRegular}
            onClick={() => window.api.openWindowsPage('storage')}
          >
            Storage settings
          </Button>
        </div>
      </Card>
      {outcome && (
        <InfoBar
          className="mt-2"
          severity={outcome.problems.length ? 'warning' : 'success'}
          title={`Freed ${formatBytes(outcome.freed)}`}
        >
          {[
            outcome.skipped > 0 &&
              `${outcome.skipped} ${outcome.skipped === 1 ? 'file was' : 'files were'} in use and stayed.`,
            ...outcome.problems
          ]
            .filter(Boolean)
            .join(' ') || 'Done.'}
        </InfoBar>
      )}
    </section>
  )
}

/* --- Power mode ------------------------------------------------------------ */

const MODES = [
  {
    id: 'efficiency',
    title: 'Save energy',
    text: 'Longer battery life and a quieter PC; a little slower.',
    icon: LeafOneRegular
  },
  {
    id: 'balanced',
    title: 'Balanced',
    text: 'Fast when you need it, saving energy the rest of the time.',
    icon: ScalesRegular
  },
  {
    id: 'performance',
    title: 'Best performance',
    text: 'The most speed for games and heavy apps; uses more power and gets warmer.',
    icon: FlashRegular
  }
]

function PowerMode() {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    window.api
      .getPowerMode()
      .then(setState)
      .catch((err) => {
        setState({ modesAvailable: false, unreadable: true })
        setError(errorText(err, 'Couldn’t read the power mode.'))
      })
  }, [])

  const choose = async (mode) => {
    setSaving(mode)
    setError(null)
    const result = await window.api
      .setPowerMode(mode)
      .catch((err) => ({ ok: false, error: errorText(err) }))
    const problem = actionError(result)
    if (problem) setError(problem)
    else setState((s) => ({ ...s, mode }))
    setSaving(null)
  }

  return (
    <section>
      <SectionTitle
        title="Power mode"
        description="How hard your PC works. Windows keeps one mode on battery and another when plugged in; this changes the one in use now."
      />
      {state === null ? (
        <Card className="flex items-center gap-3 p-5 text-text-secondary">
          <ProgressRing /> Reading the power mode…
        </Card>
      ) : state.modesAvailable ? (
        <div role="radiogroup" aria-label="Power mode" className="grid gap-3 sm:grid-cols-3">
          {MODES.map(({ id, title, text, icon: Icon }) => {
            const active = state.mode === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={saving !== null}
                onClick={() => choose(id)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-overlay border p-5 text-left transition-colors',
                  active
                    ? 'border-accent-fill bg-card ring-1 ring-accent-fill'
                    : 'border-card-stroke bg-card hover:bg-subtle-hover'
                )}
              >
                <span
                  className={cn(
                    'grid size-10 place-items-center rounded-control',
                    active ? 'bg-brand-cyan text-brand-carbon' : 'bg-subtle-hover'
                  )}
                >
                  {saving === id ? <ProgressRing /> : <Icon aria-hidden className="size-5" />}
                </span>
                <span className="font-brand text-[17px] font-semibold">{title}</span>
                <span className="text-text-secondary">{text}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <p className="min-w-0 flex-1 text-text-secondary">
            {state.unreadable
              ? 'WinDiag couldn’t read the power settings on this PC.'
              : `Your PC uses the “${state.planName ?? 'custom'}” power plan, which has no modes. Choose the Balanced plan in the power settings to use them.`}
          </p>
          <Button icon={OpenRegular} onClick={() => window.api.openWindowsPage('power')}>
            Power settings
          </Button>
        </Card>
      )}
      {error && state?.modesAvailable && (
        <InfoBar severity="warning" title="The power mode didn’t change" className="mt-2">
          {error}
        </InfoBar>
      )}
    </section>
  )
}
