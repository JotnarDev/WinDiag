import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowClockwiseRegular,
  ArrowDownloadRegular,
  ArrowSyncRegular,
  CheckmarkCircleFilled,
  CircleRegular,
  ErrorCircleRegular,
  RecordStopRegular,
  StoreMicrosoftRegular,
  SubtractCircleRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressRing } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'
import { errorText } from './actions'

/*
 * Apps: trusted apps grouped by what people do, installed with winget, and
 * one button that updates every app winget can update. Installs run one at
 * a time in the main process; this page shows their progress.
 */

const SHOWN_UPDATES = 5

export function AppsPage() {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('productivity')
  const [chosen, setChosen] = useState(() => new Set())
  const [job, setJob] = useState(null)
  const [jobError, setJobError] = useState(null)
  const [allUpdates, setAllUpdates] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setState(await window.api.getApps())
    } catch (err) {
      setState({ available: true, apps: [], groups: [], updates: [] })
      setError(errorText(err, 'Couldn’t read your apps.'))
    }
  }, [])

  useEffect(() => {
    load()
    // A job may still be running from an earlier visit
    window.api
      .getAppsJob()
      .then((j) => j && !j.done && setJob(j))
      .catch(() => {})
    return window.api.onAppsProgress(setJob)
  }, [load])

  const running = Boolean(job && !job.done)

  const start = async (call) => {
    setJobError(null)
    try {
      const result = await call()
      setJob(result)
      if (result?.items?.length === 0) await load()
    } catch (err) {
      setJobError(errorText(err, 'Couldn’t start.'))
    }
  }

  const install = () =>
    start(async () => {
      const ids = [...chosen]
      setChosen(new Set())
      return window.api.installApps(ids)
    })

  const finish = async () => {
    setJob(null)
    setState(null)
    await load()
  }

  const apps = useMemo(() => state?.apps ?? [], [state])
  const inTab = apps.filter((a) => a.group === tab)
  const choosable = inTab.filter((a) => !a.installed)
  const allChosen = choosable.length > 0 && choosable.every((a) => chosen.has(a.id))

  const toggle = (id, on) =>
    setChosen((set) => {
      const next = new Set(set)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <Page
      title="Apps"
      description="Install trusted apps straight from their makers, and keep all your apps up to date."
    >
      {state === null ? (
        <Card className="flex items-center gap-3 p-5 text-text-secondary">
          <ProgressRing /> Checking your apps… The first time can take a minute.
        </Card>
      ) : !state.available ? (
        <InfoBar
          severity="warning"
          title="App Installer is missing"
          action={
            <Button
              icon={StoreMicrosoftRegular}
              onClick={() => window.api.openWindowsPage('appInstaller')}
            >
              Get App Installer
            </Button>
          }
        >
          WinDiag installs apps with winget, which comes with Microsoft’s App Installer. Install or
          update it from the Microsoft Store, then come back.
        </InfoBar>
      ) : (
        <div className="flex flex-col gap-6">
          {error && (
            <InfoBar severity="warning" title="Couldn’t read your apps">
              {error}
            </InfoBar>
          )}
          {jobError && (
            <InfoBar severity="warning" title="Couldn’t start">
              {jobError}
            </InfoBar>
          )}

          {job && job.items.length > 0 ? (
            <JobCard job={job} onFinish={finish} />
          ) : (
            <UpdatesCard
              updates={state.updates ?? []}
              showAll={allUpdates}
              onShowAll={() => setAllUpdates(true)}
              onUpdate={() => start(() => window.api.updateAllApps())}
            />
          )}

          <section>
            <h2 className="mb-2 font-brand text-subtitle font-semibold">Install apps</h2>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div role="tablist" aria-label="App groups" className="flex flex-wrap gap-1">
                {state.groups.map((g) => {
                  const count = apps.filter((a) => a.group === g.id && chosen.has(a.id)).length
                  return (
                    <button
                      key={g.id}
                      role="tab"
                      type="button"
                      aria-selected={g.id === tab}
                      onClick={() => setTab(g.id)}
                      className={cn(
                        'h-8 rounded-control px-3 text-body',
                        g.id === tab
                          ? 'bg-subtle-hover font-semibold'
                          : 'text-text-secondary hover:bg-subtle-hover'
                      )}
                    >
                      {g.title}
                      {count > 0 && ` (${count})`}
                    </button>
                  )
                })}
              </div>
              <label
                className={cn(
                  'ml-auto inline-flex items-center gap-2',
                  choosable.length === 0 || running ? 'text-text-disabled' : 'cursor-pointer'
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent-fill)]"
                  checked={allChosen}
                  disabled={choosable.length === 0 || running}
                  onChange={(e) => choosable.forEach((a) => toggle(a.id, e.target.checked))}
                />
                Select all
              </label>
            </div>

            <div className="@container">
              <ul className="grid gap-2 @[640px]:grid-cols-2">
                {inTab.map((a) => (
                  <li key={a.id}>
                    <label
                      className={cn(
                        'flex h-full items-start gap-3 rounded-overlay border border-card-stroke bg-card px-4 py-3',
                        !a.installed && !running && 'cursor-pointer hover:bg-subtle-hover'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-[var(--accent-fill)]"
                        checked={a.installed || chosen.has(a.id)}
                        disabled={a.installed || running}
                        onChange={(e) => toggle(a.id, e.target.checked)}
                        aria-label={a.name}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          {a.name}
                          {a.installed && <Badge tone="neutral">Installed</Badge>}
                        </span>
                        <span className="block text-text-secondary">{a.text}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-overlay border border-card-stroke bg-flyout px-5 py-3 shadow-lg">
            <p className="min-w-0 flex-1 text-text-secondary">
              {chosen.size === 0
                ? 'Choose the apps you want. Each one comes straight from its maker.'
                : `${chosen.size} ${chosen.size === 1 ? 'app' : 'apps'} chosen. Some may ask for permission while they install.`}
            </p>
            {chosen.size > 0 && (
              <Button disabled={running} onClick={() => setChosen(new Set())}>
                Clear
              </Button>
            )}
            <Button
              variant="accent"
              icon={ArrowDownloadRegular}
              disabled={chosen.size === 0 || running}
              onClick={install}
            >
              Install
            </Button>
          </div>

          <p className="text-caption text-text-secondary">
            Apps are installed with winget, Windows’ own app installer, from the winget and
            Microsoft Store catalogues. Most are free; some, like Zoom or Figma, have paid plans
            inside.
          </p>
        </div>
      )}
    </Page>
  )
}

function UpdatesCard({ updates, showAll, onShowAll, onUpdate }) {
  if (updates.length === 0)
    return (
      <Card className="flex items-center gap-4 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-cyan text-brand-carbon">
          <CheckmarkCircleFilled aria-hidden className="size-6" />
        </span>
        <p className="font-brand text-[18px] leading-snug font-semibold">
          Your apps are up to date.
        </p>
      </Card>
    )
  const shown = showAll ? updates : updates.slice(0, SHOWN_UPDATES)
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-cyan text-brand-carbon">
          <ArrowSyncRegular aria-hidden className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-brand text-[18px] leading-snug font-semibold">
            {updates.length === 1 ? '1 app has an update.' : `${updates.length} apps have updates.`}
          </p>
          <p className="text-text-secondary">
            Updates fix bugs and security holes. Close the apps first; some may ask for permission.
          </p>
        </div>
        <Button variant="accent" icon={ArrowSyncRegular} onClick={onUpdate}>
          Update all
        </Button>
      </div>
      <ul className="divide-y divide-card-stroke border-t border-card-stroke">
        {shown.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-x-4 px-5 py-2.5">
            <span className="min-w-0 flex-1 truncate">{u.name}</span>
            <span className="text-caption text-text-secondary tabular-nums">
              {u.version} → {u.available}
            </span>
          </li>
        ))}
      </ul>
      {!showAll && updates.length > SHOWN_UPDATES && (
        <div className="border-t border-card-stroke px-5 py-2">
          <Button variant="subtle" onClick={onShowAll}>
            Show all {updates.length}
          </Button>
        </div>
      )}
    </Card>
  )
}

const STATE_ICON = {
  waiting: { icon: CircleRegular, className: 'text-text-secondary', label: 'Waiting' },
  done: { icon: CheckmarkCircleFilled, className: 'text-accent-text', label: 'Done' },
  failed: { icon: ErrorCircleRegular, className: 'text-text-primary', label: 'Didn’t work' },
  skipped: { icon: SubtractCircleRegular, className: 'text-text-secondary', label: 'Skipped' }
}

function JobCard({ job, onFinish }) {
  const verb = job.kind === 'install' ? 'Installing' : 'Updating'
  const total = job.items.length
  const finished = job.items.filter((i) => i.state === 'done' || i.state === 'failed').length
  const failed = job.items.filter((i) => i.state === 'failed').length
  const current = job.items.find((i) => i.state === 'running')

  const title = !job.done
    ? `${verb} ${Math.min(finished + 1, total)} of ${total}${current ? `: ${current.name}` : ''}`
    : failed > 0
      ? `${failed} of ${total} didn’t ${job.kind === 'install' ? 'install' : 'update'}.`
      : job.kind === 'install'
        ? 'Your apps are installed.'
        : 'Your apps are up to date.'

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <span
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-control',
            job.done ? 'bg-brand-cyan text-brand-carbon' : 'bg-subtle-hover'
          )}
        >
          {job.done ? (
            <CheckmarkCircleFilled aria-hidden className="size-6" />
          ) : (
            <ProgressRing size={22} label={verb} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-brand text-[18px] leading-snug font-semibold">{title}</p>
          <p className="text-text-secondary">
            {!job.done
              ? job.stopping
                ? 'Stopping after this app.'
                : 'You can keep using WinDiag. Windows may ask for permission.'
              : failed > 0
                ? 'You can try again; the reasons are below and in the error log.'
                : 'You’ll find them in Start.'}
          </p>
        </div>
        {!job.done ? (
          <Button
            icon={RecordStopRegular}
            disabled={job.stopping}
            onClick={() => window.api.stopAppsJob()}
          >
            Stop after this app
          </Button>
        ) : (
          <Button variant="accent" icon={ArrowClockwiseRegular} onClick={onFinish}>
            Done
          </Button>
        )}
      </div>
      <ul className="divide-y divide-card-stroke border-t border-card-stroke">
        {job.items.map((item) => {
          const look = STATE_ICON[item.state]
          return (
            <li key={item.id} className="flex items-start gap-3 px-5 py-2.5">
              {item.state === 'running' ? (
                <ProgressRing label={`${verb} ${item.name}`} />
              ) : (
                <look.icon
                  aria-label={look.label}
                  className={cn('mt-0.5 size-4 shrink-0', look.className)}
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block">{item.name}</span>
                {(item.error || item.note) && (
                  <span className="block text-caption text-text-secondary">
                    {item.error ?? item.note}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
