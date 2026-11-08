import { useEffect, useSyncExternalStore } from 'react'
import {
  ArrowClockwiseRegular,
  ArrowDownloadRegular,
  ArrowSyncRegular,
  Battery10Regular,
  CheckmarkCircleFilled,
  ErrorCircleFilled,
  HardDriveRegular,
  KeyRegular,
  QuestionCircleRegular,
  RocketRegular,
  ShieldCheckmarkRegular,
  StorageRegular,
  WarningFilled
} from '@fluentui/react-icons'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, ProgressRing } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'

/*
 * Home: a one-click checkup of this PC. Every check runs on its own, so cards
 * fill in as answers arrive; Windows Update is the slow one.
 */

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const openPage = (id) => () => window.api.openWindowsPage(id)

/**
 * Each check turns the facts from the main process into a status
 * (good, look, attention, hidden) and a sentence anyone can follow.
 */
const CHECKS = [
  {
    id: 'security',
    title: 'Protection',
    icon: ShieldCheckmarkRegular,
    action: { label: 'Open Windows Security', run: openPage('windowsSecurity') },
    judge: ({ antivirusName, antivirusOn, definitionsCurrent, firewallOff }) => {
      if (!antivirusOn)
        return {
          status: 'attention',
          text: 'No antivirus is turned on. Turn on Microsoft Defender in Windows Security.'
        }
      if (firewallOff.length > 0)
        return {
          status: 'attention',
          text: `The firewall is off for ${firewallOff.join(', ').toLowerCase()} networks.`
        }
      if (!definitionsCurrent)
        return {
          status: 'look',
          text: `${antivirusName ?? 'Your antivirus'} is on, but its virus definitions are out of date.`
        }
      return {
        status: 'good',
        text: `${antivirusName ?? 'Your antivirus'} is on and up to date, and the firewall is on.`
      }
    }
  },
  {
    id: 'updates',
    title: 'Windows updates',
    icon: ArrowDownloadRegular,
    action: { label: 'Open Windows Update', run: openPage('windowsUpdate') },
    checkingText: 'Asking Windows Update. This can take a minute.',
    judge: ({ count, titles }) =>
      count === 0
        ? { status: 'good', text: 'Windows is up to date.' }
        : {
            status: 'look',
            text: `${plural(count, 'update is', 'updates are')} waiting to be installed.`,
            details: titles
          }
  },
  {
    id: 'drive',
    title: 'Drive health',
    icon: HardDriveRegular,
    judge: ({ healthStatus }) => {
      if (healthStatus === 'excellent' || healthStatus === 'good')
        return { status: 'good', text: 'Your main drive is healthy.' }
      if (healthStatus === 'fair')
        return {
          status: 'look',
          text: 'Your main drive shows some wear. Keep a recent backup of your files.'
        }
      return {
        status: 'attention',
        text: 'Your main drive is wearing out. Back up your files now and plan to replace it.'
      }
    }
  },
  {
    id: 'space',
    title: 'Free space',
    icon: StorageRegular,
    action: { label: 'Free up space', run: openPage('storage') },
    judge: ({ drive, freeGB, totalGB, freePercent }) => {
      const amount = `${Math.round(freeGB)} GB free of ${Math.round(totalGB)} GB on ${drive}`
      if (freeGB < 5 || freePercent < 5)
        return {
          status: 'attention',
          text: `Only ${amount}. Windows needs room to update and run smoothly.`
        }
      if (freeGB < 20 || freePercent < 15)
        return { status: 'look', text: `${amount}. Space is getting tight.` }
      return { status: 'good', text: `${amount}.` }
    }
  },
  {
    id: 'battery',
    title: 'Battery',
    icon: Battery10Regular,
    judge: ({ hasBattery, healthPercent }) => {
      if (!hasBattery) return { status: 'hidden' }
      if (healthPercent === null)
        return { status: 'unknown', text: 'This battery doesn’t report its wear.' }
      const holds = `It holds ${healthPercent} % of the charge it held when new.`
      if (healthPercent >= 80) return { status: 'good', text: holds }
      if (healthPercent >= 60)
        return { status: 'look', text: `${holds} It runs out sooner than it used to.` }
      return { status: 'attention', text: `${holds} Consider replacing the battery.` }
    }
  },
  {
    id: 'startup',
    title: 'Startup apps',
    icon: RocketRegular,
    action: { label: 'Manage startup apps', run: openPage('startupApps') },
    judge: ({ enabledCount, enabled }) =>
      enabledCount > 10
        ? {
            status: 'look',
            text: `${plural(enabledCount, 'app starts', 'apps start')} with Windows, which slows down startup.`,
            details: enabled
          }
        : {
            status: 'good',
            text:
              enabledCount === 0
                ? 'No apps start with Windows.'
                : `${plural(enabledCount, 'app starts', 'apps start')} with Windows.`,
            details: enabled
          }
  },
  {
    id: 'activation',
    title: 'Activation',
    icon: KeyRegular,
    action: { label: 'Activation settings', run: openPage('activation') },
    judge: ({ activated }) =>
      activated
        ? { status: 'good', text: 'Windows is activated.' }
        : {
            status: 'attention',
            text: 'Windows isn’t activated. Some settings are locked until it is.'
          }
  },
  {
    id: 'uptime',
    title: 'Last restart',
    icon: ArrowSyncRegular,
    judge: ({ days }) =>
      days >= 7
        ? {
            status: 'look',
            text: `Your PC hasn’t restarted in ${days} days. A restart finishes updates and frees up memory.`
          }
        : {
            status: 'good',
            text: days === 0 ? 'Restarted today.' : `Restarted ${plural(days, 'day')} ago.`
          }
  }
]

/* --- Results, kept while you move between pages --------------------------- */

let state = { results: {}, startedAt: null, finishedAt: null }
const listeners = new Set()
const setState = (patch) => {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function runCheckup() {
  const results = Object.fromEntries(CHECKS.map((c) => [c.id, { checking: true }]))
  setState({ results, startedAt: Date.now(), finishedAt: null })
  const startedAt = state.startedAt
  let pending = CHECKS.length
  for (const check of CHECKS) {
    window.api
      .runCheckup(check.id)
      .catch((error) => ({ ok: false, error: error?.message }))
      .then((result) => {
        // A newer run replaced this one
        if (state.startedAt !== startedAt) return
        let verdict
        try {
          verdict = result.ok ? check.judge(result.data) : { status: 'unknown' }
        } catch {
          verdict = { status: 'unknown' }
        }
        pending -= 1
        setState({
          results: { ...state.results, [check.id]: verdict },
          finishedAt: pending === 0 ? Date.now() : null
        })
      })
  }
}

/* --- Page ----------------------------------------------------------------- */

const STATUS = {
  good: { label: 'Good', tone: 'success', icon: CheckmarkCircleFilled, color: 'text-success' },
  look: { label: 'Worth a look', tone: 'caution', icon: WarningFilled, color: 'text-caution' },
  attention: {
    label: 'Needs attention',
    tone: 'critical',
    icon: ErrorCircleFilled,
    color: 'text-critical'
  },
  unknown: {
    label: 'Couldn’t check',
    tone: 'neutral',
    icon: QuestionCircleRegular,
    color: 'text-text-secondary'
  }
}

export function HomeOverview() {
  const { results, finishedAt } = useSyncExternalStore(subscribe, () => state)

  useEffect(() => {
    if (!state.startedAt) runCheckup()
  }, [])

  const visible = CHECKS.filter((c) => results[c.id]?.status !== 'hidden')
  const checking = visible.filter((c) => results[c.id]?.checking).length
  const count = (status) => visible.filter((c) => results[c.id]?.status === status).length

  return (
    <div className="page-enter @container mx-auto w-full max-w-[1100px] px-5 pt-2 pb-10 sm:px-8">
      <Summary
        checking={checking}
        attention={count('attention')}
        look={count('look')}
        good={count('good')}
        unknown={count('unknown')}
        finishedAt={finishedAt}
      />
      <div className="mt-4 grid gap-3 @3xl:grid-cols-2">
        {visible.map((check) => (
          <CheckCard key={check.id} check={check} result={results[check.id]} />
        ))}
      </div>
    </div>
  )
}

function Summary({ checking, attention, look, good, unknown, finishedAt }) {
  let headline
  let detail
  if (checking > 0 && attention + look + good + unknown === 0) {
    headline = 'Checking your PC…'
    detail = 'This only reads how your PC is doing. Nothing is changed.'
  } else if (attention > 0) {
    headline = `${plural(attention, 'thing needs', 'things need')} your attention.`
  } else if (look > 0) {
    headline = `Your PC is fine, with ${plural(look, 'thing')} worth a look.`
  } else if (checking > 0) {
    headline = 'So far, so good.'
  } else if (unknown > 0) {
    headline = 'No problems found.'
  } else {
    headline = 'Your PC is in good shape.'
  }
  if (!detail) {
    const parts = []
    if (good) parts.push(`${good} good`)
    if (look) parts.push(`${look} worth a look`)
    if (attention) parts.push(`${attention} needing attention`)
    if (unknown) parts.push(`${unknown} couldn’t be checked`)
    if (checking) parts.push(`${checking} still checking`)
    detail = parts.join(' · ')
  }
  const mood = attention > 0 ? 'attention' : look > 0 ? 'look' : 'good'
  const time = finishedAt
    ? new Date(finishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <Card className="grid overflow-hidden @3xl:grid-cols-[minmax(200px,260px)_1fr]">
      <div className="flex items-center justify-center bg-brand-cyan px-6 py-6 text-brand-carbon">
        <SummaryMark mood={checking > 0 ? 'checking' : mood} />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-4 px-6 py-6">
        <div>
          <p className="text-text-secondary">Checkup</p>
          <h1 className="font-brand text-[32px] leading-[1.15] font-semibold tracking-[-0.01em] text-balance">
            {headline}
          </h1>
          <p className="mt-2 text-text-secondary">{detail}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="accent"
            icon={ArrowClockwiseRegular}
            disabled={checking > 0}
            onClick={runCheckup}
          >
            Check again
          </Button>
          {checking > 0 ? (
            <span className="inline-flex items-center gap-2 text-text-secondary">
              <ProgressRing label="Checking" /> Checking…
            </span>
          ) : (
            time && <span className="text-caption text-text-secondary">Checked at {time}</span>
          )}
        </div>
      </div>
    </Card>
  )
}

/** The big glyph in the cyan panel: a ring that closes when all is well. */
function SummaryMark({ mood }) {
  const Icon =
    mood === 'attention'
      ? ErrorCircleFilled
      : mood === 'look'
        ? WarningFilled
        : mood === 'good'
          ? CheckmarkCircleFilled
          : null
  return (
    <div className="relative grid size-[120px] place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={mood === 'checking' ? '80 247' : '327 0'}
          className={cn(
            'origin-center',
            mood === 'checking' && 'animate-spin [animation-duration:1.4s]'
          )}
        />
      </svg>
      {Icon && <Icon aria-hidden className="size-14" />}
    </div>
  )
}

function CheckCard({ check, result = { checking: true } }) {
  const Icon = check.icon
  const status = result.checking ? null : (STATUS[result.status] ?? STATUS.unknown)
  const StatusIcon = status?.icon
  const text = result.checking
    ? (check.checkingText ?? 'Checking…')
    : (result.text ?? 'WinDiag couldn’t read this on this PC.')

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-subtle-hover">
          <Icon aria-hidden className="size-5" />
        </span>
        <h2 className="min-w-0 flex-1 truncate font-brand text-[17px] font-semibold">
          {check.title}
        </h2>
        {status ? (
          <Badge tone={status.tone}>{status.label}</Badge>
        ) : (
          <ProgressRing label={`Checking ${check.title.toLowerCase()}`} />
        )}
      </div>
      <p className={cn('flex items-start gap-2', result.checking && 'text-text-secondary')}>
        {StatusIcon && (
          <StatusIcon aria-hidden className={cn('mt-0.5 size-4 shrink-0', status.color)} />
        )}
        <span className="min-w-0">{text}</span>
      </p>
      {result.details?.length > 0 && <Details items={result.details} />}
      {check.action && !result.checking && (
        <div className="mt-auto pt-1">
          <Button onClick={check.action.run}>{check.action.label}</Button>
        </div>
      )}
    </Card>
  )
}

function Details({ items }) {
  const shown = items.slice(0, 4)
  const more = items.length - shown.length
  return (
    <ul className="ml-6 list-disc pl-4 text-caption text-text-secondary">
      {shown.map((item, i) => (
        <li key={`${item}-${i}`} className="truncate">
          {item}
        </li>
      ))}
      {more > 0 && <li className="list-none -ml-4">and {more} more</li>}
    </ul>
  )
}
