import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowClockwiseRegular,
  ArrowDownloadRegular,
  ArrowSyncRegular,
  CheckmarkCircleFilled,
  CircleRegular,
  ErrorCircleRegular,
  OpenRegular,
  SubtractCircleRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, ContentDialog, InfoBar, ProgressRing } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'
import { errorText } from './actions'

/*
 * Updates: what Windows Update offers (Windows, Microsoft and drivers),
 * installed in one go with a restore point before drivers, and the PC
 * maker's page for drivers and BIOS that Windows Update doesn't bring.
 */

const formatSize = (bytes) => {
  if (!(bytes > 0)) return null
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}

// A date alone ("2022-03-01") is that day here, not midnight UTC
const toDate = (value) => {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value)
}

const formatDate = (value) => {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

const yearsSince = (value) => {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return null
  return (Date.now() - date.getTime()) / (365.25 * 24 * 3600e3)
}

const LISTS = [
  {
    id: 'windows',
    title: 'Windows and Microsoft',
    text: 'Security fixes and improvements. We recommend installing them all.',
    pick: (u) => !u.driver && !u.optional,
    preselect: true
  },
  {
    id: 'optional',
    title: 'Optional',
    text: 'Previews of next month’s fixes and extra features. Install them if they fix something for you.',
    pick: (u) => !u.driver && u.optional,
    preselect: false
  },
  {
    id: 'drivers',
    title: 'Drivers',
    text: 'Software for your PC’s parts, tested by Microsoft and the maker. Install them if something doesn’t work right; WinDiag makes a restore point first.',
    pick: (u) => u.driver,
    preselect: false
  }
]

export function UpdatesPage() {
  const [search, setSearch] = useState(null)
  const [error, setError] = useState(null)
  const [chosen, setChosen] = useState(() => new Set())
  const [restorePoint, setRestorePoint] = useState(true)
  const [job, setJob] = useState(null)
  const [startError, setStartError] = useState(null)
  const [confirmRestart, setConfirmRestart] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    setSearch(null)
    try {
      const result = await window.api.getWindowsUpdates()
      setSearch(result)
      setChosen(
        new Set(
          result.updates.filter((u) => LISTS.find((l) => l.pick(u))?.preselect).map((u) => u.id)
        )
      )
    } catch (err) {
      setSearch({ updates: [], failed: true })
      setError(errorText(err, 'Windows Update didn’t answer.'))
    }
  }, [])

  useEffect(() => {
    window.api
      .getUpdatesJob()
      .then((j) => {
        if (j && !j.done) setJob(j)
      })
      .catch(() => {})
    load()
    return window.api.onUpdatesProgress(setJob)
  }, [load])

  const updates = useMemo(() => search?.updates ?? [], [search])
  const running = Boolean(job && !job.done)
  const driversChosen = updates.some((u) => u.driver && chosen.has(u.id))

  const install = async (withRestorePoint) => {
    setStartError(null)
    try {
      setJob(await window.api.installWindowsUpdates([...chosen], withRestorePoint))
    } catch (err) {
      setStartError(errorText(err, 'Couldn’t start installing.'))
    }
  }

  const finish = () => {
    setJob(null)
    load()
  }

  const toggle = (id, on) =>
    setChosen((set) => {
      const next = new Set(set)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const restartNeeded = Boolean(search?.restartPending || job?.restart)

  return (
    <Page title="Updates" description="Keep Windows, your drivers and your BIOS up to date.">
      <div className="flex flex-col gap-6">
        {restartNeeded && !running && (
          <InfoBar
            severity="warning"
            title="Restart to finish installing updates"
            action={
              <Button icon={ArrowClockwiseRegular} onClick={() => setConfirmRestart(true)}>
                Restart now
              </Button>
            }
          >
            Some updates are installed but only take effect after Windows restarts.
          </InfoBar>
        )}

        <section>
          <h2 className="mb-2 font-brand text-subtitle font-semibold">Windows Update</h2>
          {job && job.items.length > 0 ? (
            <JobCard
              job={job}
              updates={updates}
              onFinish={finish}
              onRetryWithout={() => install(false)}
            />
          ) : search === null ? (
            <Card className="flex items-center gap-3 p-5 text-text-secondary">
              <ProgressRing /> Asking Windows Update… This can take a minute or two.
            </Card>
          ) : search.failed ? (
            <InfoBar
              severity="warning"
              title="Couldn’t check for updates"
              action={
                <Button icon={ArrowSyncRegular} onClick={load}>
                  Try again
                </Button>
              }
            >
              {error}
            </InfoBar>
          ) : (
            <Summary
              search={search}
              chosenCount={chosen.size}
              onCheck={load}
              onInstall={() => install(driversChosen && restorePoint)}
              restorePoint={driversChosen ? restorePoint : null}
              onRestorePoint={setRestorePoint}
            />
          )}
          {startError && (
            <InfoBar severity="warning" title="Couldn’t start" className="mt-2">
              {startError}
            </InfoBar>
          )}
        </section>

        {!job &&
          LISTS.map((list) => {
            const items = updates.filter(list.pick)
            if (items.length === 0) return null
            return (
              <section key={list.id}>
                <h2 className="font-brand text-subtitle font-semibold">{list.title}</h2>
                <p className="mb-2 text-text-secondary">{list.text}</p>
                <Card>
                  <ul className="divide-y divide-card-stroke">
                    {items.map((u) => (
                      <li key={u.id}>
                        <label className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-subtle-hover">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 shrink-0 accent-[var(--accent-fill)]"
                            checked={chosen.has(u.id)}
                            disabled={running}
                            onChange={(e) => toggle(u.id, e.target.checked)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              {u.title}
                              {u.firmware && <Badge tone="neutral">Firmware</Badge>}
                            </span>
                            <span className="block text-caption text-text-secondary">
                              {[
                                u.kb.length > 0 && `KB${u.kb[0]}`,
                                u.driver && u.driverClass,
                                u.driver &&
                                  u.driverDate &&
                                  `driver from ${u.driverDate.slice(0, 4)}`,
                                formatSize(u.size),
                                u.downloaded && 'downloaded',
                                u.restart === 1 && 'needs a restart'
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )
          })}

        <MakerSection firmwareOffered={updates.some((u) => u.firmware)} />
      </div>

      <ContentDialog
        open={confirmRestart}
        title="Restart Windows now?"
        primaryText="Restart"
        onPrimary={async () => {
          setConfirmRestart(false)
          await window.api.restartWindows().catch(() => {})
        }}
        onClose={() => setConfirmRestart(false)}
      >
        Save your work and close your apps first. Windows restarts a few seconds after you confirm,
        and may take a while to finish the updates.
      </ContentDialog>
    </Page>
  )
}

function Summary({ search, chosenCount, onCheck, onInstall, restorePoint, onRestorePoint }) {
  const count = search.updates.length
  const last = search.lastInstalled && formatDate(search.lastInstalled)
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-cyan text-brand-carbon">
          {count === 0 ? (
            <CheckmarkCircleFilled aria-hidden className="size-6" />
          ) : (
            <ArrowDownloadRegular aria-hidden className="size-6" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-brand text-[18px] leading-snug font-semibold">
            {count === 0
              ? 'Windows is up to date.'
              : count === 1
                ? '1 update is available.'
                : `${count} updates are available.`}
          </p>
          <p className="text-text-secondary">
            {last ? `Updates last installed on ${last}.` : 'Checked with Windows Update just now.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={ArrowSyncRegular} onClick={onCheck}>
            Check again
          </Button>
          {count > 0 && (
            <Button
              variant="accent"
              icon={ArrowDownloadRegular}
              disabled={chosenCount === 0}
              onClick={onInstall}
            >
              {chosenCount === 0 ? 'Install' : `Install ${chosenCount}`}
            </Button>
          )}
        </div>
      </div>
      {restorePoint !== null && (
        <label className="inline-flex cursor-pointer items-center gap-2 self-start">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent-fill)]"
            checked={restorePoint}
            onChange={(e) => onRestorePoint(e.target.checked)}
          />
          Create a restore point first, so you can undo the drivers
        </label>
      )}
      {count > 0 && (
        <p className="text-caption text-text-secondary">
          Windows asks for permission once. You can keep working while updates install.
        </p>
      )}
    </Card>
  )
}

const STATE_TEXT = {
  waiting: 'Waiting',
  downloading: 'Downloading',
  installing: 'Installing',
  done: 'Installed',
  failed: 'Didn’t install',
  skipped: 'Not installed'
}

function JobCard({ job, updates, onFinish, onRetryWithout }) {
  const titleOf = (item) =>
    item.title ?? updates.find((u) => u.id === item.id)?.title ?? 'Windows update'
  const total = job.items.length
  const done = job.items.filter((i) => i.state === 'done').length
  const failed = job.items.filter((i) => i.state === 'failed').length
  const current = job.items.find((i) => i.state === 'downloading' || i.state === 'installing')

  let title
  let text
  if (!job.done) {
    title =
      job.phase === 'restorePoint'
        ? 'Creating a restore point…'
        : current
          ? `${STATE_TEXT[current.state]} ${done + failed + 1} of ${total}`
          : 'Getting ready…'
    text =
      job.phase === 'waiting'
        ? 'Allow WinDiag to make changes when Windows asks.'
        : 'You can keep working. Large updates can take a while.'
  } else if (job.cancelled) {
    title = 'Nothing was installed.'
    text = 'Windows didn’t get permission to install the updates.'
  } else if (job.error) {
    title =
      done > 0
        ? `${done} of ${total} installed, then Windows Update stopped.`
        : 'Nothing was installed.'
    text = job.error
  } else {
    title =
      failed === 0
        ? total === 1
          ? 'The update is installed.'
          : 'The updates are installed.'
        : `${failed} of ${total} didn’t install.`
    text = job.restart
      ? 'Restart Windows to finish.'
      : failed > 0
        ? 'Windows will offer them again; the reasons are below and in the error log.'
        : 'All done.'
  }

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
            <ProgressRing size={22} label="Installing updates" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-brand text-[18px] leading-snug font-semibold">{title}</p>
          <p className="text-text-secondary">{text}</p>
        </div>
        {job.done && (
          <div className="flex flex-wrap gap-2">
            {job.restorePointFailed && (
              <Button onClick={onRetryWithout}>Install without a restore point</Button>
            )}
            <Button variant="accent" icon={ArrowSyncRegular} onClick={onFinish}>
              Done
            </Button>
          </div>
        )}
      </div>
      <ul className="divide-y divide-card-stroke border-t border-card-stroke">
        {job.items.map((item) => {
          const active = item.state === 'downloading' || item.state === 'installing'
          const Icon =
            item.state === 'done'
              ? CheckmarkCircleFilled
              : item.state === 'failed'
                ? ErrorCircleRegular
                : item.state === 'skipped'
                  ? SubtractCircleRegular
                  : CircleRegular
          return (
            <li key={item.id} className="flex items-start gap-3 px-5 py-2.5">
              {active ? (
                <ProgressRing label={STATE_TEXT[item.state]} />
              ) : (
                <Icon
                  aria-hidden
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    item.state === 'done' ? 'text-accent-text' : 'text-text-secondary'
                  )}
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block">{titleOf(item)}</span>
                <span className="block text-caption text-text-secondary">
                  {item.error ?? STATE_TEXT[item.state]}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function MakerSection({ firmwareOffered }) {
  const [maker, setMaker] = useState(null)
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    window.api
      .getMakerInfo()
      .then(setMaker)
      .catch(() => setMaker(false))
  }, [])

  if (maker === false) return null
  const age = maker?.biosDate ? yearsSince(maker.biosDate) : null
  const biosYear = maker?.biosDate ? toDate(maker.biosDate).getFullYear() : null
  const name = maker?.manufacturer ?? 'your PC’s maker'

  return (
    <section>
      <h2 className="font-brand text-subtitle font-semibold">Drivers and BIOS from the maker</h2>
      <p className="mb-2 text-text-secondary">
        Windows Update doesn’t bring everything. Your PC’s maker has the latest drivers and BIOS for
        your exact model.
      </p>
      <Card className="flex flex-col gap-4 p-5">
        {maker === null ? (
          <p className="inline-flex items-center gap-2 text-text-secondary">
            <ProgressRing /> Reading your PC’s details…
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
              <dt className="text-text-secondary">PC</dt>
              <dd>{[maker.manufacturer, maker.model].filter(Boolean).join(' ') || 'Unknown'}</dd>
              <dt className="text-text-secondary">BIOS</dt>
              <dd>
                {maker.biosVersion ?? 'Unknown'}
                {maker.biosDate && `, from ${formatDate(maker.biosDate) ?? maker.biosDate}`}
              </dd>
            </dl>
            {firmwareOffered ? (
              <InfoBar severity="info" title="Windows Update has a firmware update">
                It’s in the Drivers list above. Keep the charger connected while it installs.
              </InfoBar>
            ) : (
              age !== null &&
              age >= 2 && (
                <InfoBar severity="info" title={`Your BIOS is from ${biosYear}`}>
                  Makers fix bugs and security problems in BIOS updates. See if {name} has a newer
                  one for your model; install it only from {name}, with the charger connected.
                </InfoBar>
              )
            )}
            <div className="flex flex-wrap items-center gap-3">
              {maker.hasSupportPage && (
                <Button
                  icon={OpenRegular}
                  onClick={() =>
                    window.api
                      .openMakerSupport()
                      .catch((err) => setProblem(errorText(err, 'Couldn’t open the page.')))
                  }
                >
                  Drivers and BIOS on {maker.manufacturer}’s site
                </Button>
              )}
              {maker.makerApp && (
                <p className="min-w-0 flex-1 text-caption text-text-secondary">
                  {maker.manufacturer}’s own app, {maker.makerApp}, can also find and install them.
                </p>
              )}
              {!maker.hasSupportPage && (
                <p className="text-text-secondary">
                  Look for “drivers” or “support” on {name}’s website, with your model name.
                </p>
              )}
            </div>
            {problem && <p className="text-caption text-text-secondary">{problem}</p>}
          </>
        )}
      </Card>
    </section>
  )
}
