import { useCallback, useEffect, useState } from 'react'
import {
  ArrowClockwiseRegular,
  ArrowDownloadRegular,
  CheckmarkCircleFilled,
  ErrorCircleFilled,
  ShieldGlobeRegular,
  InfoRegular,
  KeyRegular,
  LockClosedRegular,
  PersonLockRegular,
  QuestionCircleRegular,
  ShieldCheckmarkRegular,
  ShieldProhibitedRegular,
  ShieldTaskRegular,
  WarningFilled,
  DeveloperBoardRegular,
  ShieldKeyholeRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressRing } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'
import { actionError, errorText } from './actions'

/*
 * Security: is this PC protected? Each card reads one part (antivirus,
 * firewall, updates, encryption…), says what it means in plain words, and
 * offers the fix: done by WinDiag when it's safe, otherwise the right page
 * of Windows Security or Settings.
 */

const STATUS = {
  good: { label: 'Good', tone: 'success', icon: CheckmarkCircleFilled, color: 'text-success' },
  look: { label: 'Worth a look', tone: 'caution', icon: WarningFilled, color: 'text-caution' },
  attention: {
    label: 'Needs attention',
    tone: 'critical',
    icon: ErrorCircleFilled,
    color: 'text-critical'
  },
  info: { label: 'Optional', tone: 'neutral', icon: InfoRegular, color: 'text-text-secondary' },
  unknown: {
    label: 'Couldn’t check',
    tone: 'neutral',
    icon: QuestionCircleRegular,
    color: 'text-text-secondary'
  }
}

const DAY = 24 * 3600e3
const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : null)
const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : null
const ago = (days) => (days < 1 ? 'today' : days < 2 ? 'yesterday' : `${Math.floor(days)} days ago`)

const page = (id) => () => window.api.openSecurityPage(id)

/** The cards, from what was read; a fix is named by its key in FIXES. */
function buildCards({ status, updates, activated, onNavigate }) {
  const cards = []
  const defender = status?.defender
  const defenderActive = Boolean(defender && /^normal/i.test(defender.mode ?? ''))
  const activeAv = (status?.antivirus ?? []).filter((av) => av.on)

  // Antivirus
  if (!status) cards.push({ id: 'antivirus', title: 'Antivirus', icon: ShieldCheckmarkRegular })
  else if (activeAv.length === 0 && !defenderActive)
    cards.push({
      id: 'antivirus',
      title: 'Antivirus',
      icon: ShieldCheckmarkRegular,
      status: 'attention',
      text: 'No antivirus is on. Turn on Microsoft Defender in Windows Security.',
      actions: [{ label: 'Open virus protection', run: page('virusSettings') }]
    })
  else if (defenderActive) {
    const age = daysSince(defender.signaturesUpdated)
    const scan = daysSince(defender.quickScan ?? defender.fullScan)
    const facts = [
      ['Definitions', defender.signaturesUpdated ? ago(age) : 'unknown'],
      ['Last scan', scan === null ? 'never' : ago(scan)]
    ]
    const actions = [
      { key: 'update', label: 'Update definitions', icon: ArrowDownloadRegular, fix: 'update' },
      { key: 'scan', label: 'Quick scan', icon: ShieldTaskRegular, fix: 'scan' },
      { label: 'Protection history', run: page('protectionHistory'), subtle: true }
    ]
    if (!defender.realTime)
      cards.push({
        id: 'antivirus',
        title: 'Microsoft Defender',
        icon: ShieldCheckmarkRegular,
        status: 'attention',
        text: 'Real-time protection is off, so new threats aren’t caught as they arrive. Turn it on in Windows Security.',
        facts,
        actions: [{ label: 'Open virus settings', run: page('virusSettings') }, ...actions]
      })
    else if (age === null || age > 3)
      cards.push({
        id: 'antivirus',
        title: 'Microsoft Defender',
        icon: ShieldCheckmarkRegular,
        status: 'look',
        text:
          age === null
            ? 'Defender is on, but WinDiag couldn’t see when its definitions were last updated.'
            : `Defender is on, but its definitions are ${Math.floor(age)} days old. Update them so it knows the latest threats.`,
        facts,
        actions
      })
    else
      cards.push({
        id: 'antivirus',
        title: 'Microsoft Defender',
        icon: ShieldCheckmarkRegular,
        status: 'good',
        text:
          scan === null || scan > 30
            ? 'Defender is on and up to date. It hasn’t scanned the whole PC in a while; a quick scan takes a few minutes.'
            : 'Defender is on and up to date, and checks files as you open them.',
        facts,
        actions
      })
  } else {
    const av = activeAv[0]
    cards.push({
      id: 'antivirus',
      title: av.name,
      icon: ShieldCheckmarkRegular,
      status: av.upToDate ? 'good' : 'look',
      text: av.upToDate
        ? `${av.name} is protecting this PC. Microsoft Defender steps aside while it does.`
        : `${av.name} is on, but Windows says it isn’t up to date. Open it and update it.`
    })
  }

  // Firewall
  if (status) {
    const off = status.firewall.filter((p) => !p.on).map((p) => p.name.toLowerCase())
    cards.push({
      id: 'firewall',
      title: 'Firewall',
      icon: ShieldGlobeRegular,
      status: status.firewall.length === 0 ? 'unknown' : off.length ? 'attention' : 'good',
      text: off.length
        ? `The firewall is off for ${off.join(', ')} networks, so other devices can reach this PC freely.`
        : 'The firewall is on for every type of network.',
      actions: off.length
        ? [{ key: 'firewall', label: 'Turn on the firewall', fix: 'firewall', accent: true }]
        : [{ label: 'Firewall settings', run: page('firewall'), subtle: true }]
    })
  } else cards.push({ id: 'firewall', title: 'Firewall', icon: ShieldGlobeRegular })

  // Updates
  cards.push(
    updates === undefined
      ? {
          id: 'updates',
          title: 'Windows updates',
          icon: ArrowDownloadRegular,
          checkingText: 'Asking Windows Update…'
        }
      : updates === null
        ? {
            id: 'updates',
            title: 'Windows updates',
            icon: ArrowDownloadRegular,
            status: 'unknown',
            text: 'Windows Update didn’t answer.'
          }
        : {
            id: 'updates',
            title: 'Windows updates',
            icon: ArrowDownloadRegular,
            status: updates.count === 0 ? 'good' : 'look',
            text:
              updates.count === 0
                ? 'Windows has the latest security fixes.'
                : `${updates.count === 1 ? '1 update is' : `${updates.count} updates are`} waiting. Updates close security holes that attackers use.`,
            actions: updates.count
              ? [{ label: 'Go to Updates', run: () => onNavigate?.('updates'), accent: true }]
              : []
          }
  )

  // Unwanted apps and tamper protection: Defender's own settings
  if (status && defenderActive) {
    const pua = defender.pua
    cards.push({
      id: 'pua',
      title: 'Block unwanted apps',
      icon: ShieldProhibitedRegular,
      status: pua === 1 ? 'good' : 'look',
      text:
        pua === 1
          ? 'Defender blocks adware, bundled toolbars and other apps that come with free downloads.'
          : 'Defender can block adware, bundled toolbars and other unwanted apps that sneak in with free downloads. It’s off.',
      actions: pua === 1 ? [] : [{ key: 'pua', label: 'Turn on', fix: 'pua', accent: true }]
    })
    cards.push({
      id: 'tamper',
      title: 'Tamper protection',
      icon: ShieldKeyholeRegular,
      status: defender.tamper ? 'good' : 'look',
      text: defender.tamper
        ? 'Malware can’t turn Defender off behind your back.'
        : 'It’s off, so malware could turn Defender off without you noticing. Turn it on in Windows Security.',
      actions: defender.tamper ? [] : [{ label: 'Open virus settings', run: page('virusSettings') }]
    })
  }

  // Activation
  cards.push(
    activated === undefined
      ? { id: 'activation', title: 'Activation', icon: KeyRegular }
      : {
          id: 'activation',
          title: 'Activation',
          icon: KeyRegular,
          status: activated === null ? 'unknown' : activated ? 'good' : 'look',
          text: activated
            ? 'Windows is genuine and activated.'
            : 'Windows isn’t activated. It still gets security updates, but some settings are locked.',
          actions:
            activated === false
              ? [
                  {
                    label: 'Activation settings',
                    run: () => window.api.openWindowsPage('activation')
                  }
                ]
              : []
        }
  )

  if (!status) return cards

  // Drive encryption
  const enc = status.encryption
  const encryptionText = {
    on: 'Your Windows drive is encrypted: if the PC is lost or stolen, nobody can read your files without your sign-in or recovery key.',
    off: 'Your Windows drive isn’t encrypted. If a laptop is lost or stolen, someone could take out the drive and read your files.',
    encrypting: 'Your Windows drive is being encrypted. You can keep using the PC.',
    decrypting: 'Your Windows drive is being decrypted, so it won’t be protected when it ends.',
    suspended: 'Encryption is paused, often for a BIOS update. It resumes after Windows restarts.',
    waiting:
      'Encryption is ready but not switched on yet. Sign in with a Microsoft account, or turn it on in Settings, to finish.',
    unsupported:
      'This PC can’t encrypt its drive with Windows. Windows Home only offers it on some PCs.'
  }
  cards.push({
    id: 'encryption',
    title: 'Drive encryption',
    icon: LockClosedRegular,
    status:
      enc === null
        ? 'unknown'
        : enc === 'on' || enc === 'encrypting'
          ? 'good'
          : enc === 'unsupported'
            ? 'info'
            : 'look',
    text:
      enc === null ? 'WinDiag couldn’t read the encryption of this drive.' : encryptionText[enc],
    actions:
      enc === 'on'
        ? [{ label: 'Find your recovery key', run: page('recoveryKey'), subtle: true }]
        : enc === 'unsupported' || enc === null
          ? []
          : [
              { label: 'Device encryption', run: page('deviceEncryption') },
              { label: 'BitLocker', run: page('bitlocker'), subtle: true }
            ]
  })

  // Secure Boot and TPM
  const tpm = status.tpm
  const deviceProblems = []
  if (status.secureBoot === false)
    deviceProblems.push(
      'Secure Boot is off. It stops malware that loads before Windows, and is turned on in the UEFI setup.'
    )
  if (status.secureBoot === null)
    deviceProblems.push('The PC starts in legacy BIOS mode, which has no Secure Boot.')
  if (!tpm)
    deviceProblems.push('No security chip (TPM) was found. It may be turned off in the UEFI setup.')
  else if (tpm.version === '1.2')
    deviceProblems.push('The security chip is TPM 1.2; Windows 11 needs 2.0.')
  cards.push({
    id: 'device',
    title: 'Secure Boot and TPM',
    icon: DeveloperBoardRegular,
    status: deviceProblems.length ? 'look' : 'good',
    text: deviceProblems.length
      ? deviceProblems.join(' ')
      : `Secure Boot is on and the security chip (TPM ${tpm.version ?? ''}) is ready. Together they stop malware that starts before Windows.`,
    actions: [{ label: 'Device security', run: page('deviceSecurity'), subtle: true }]
  })

  // Memory integrity
  cards.push({
    id: 'memoryIntegrity',
    title: 'Memory integrity',
    icon: ShieldTaskRegular,
    status: status.memoryIntegrity ? 'good' : 'info',
    text: status.memoryIntegrity
      ? 'On: Windows blocks malicious drivers from reaching its core.'
      : 'Off. It blocks malicious drivers from reaching Windows’ core; Windows Security tells you if any driver you have is incompatible. Some older games and anti-cheat tools need it off.',
    actions: [{ label: 'Core isolation', run: page('coreIsolation'), subtle: true }]
  })

  // User Account Control
  const uacOk = status.uac.enabled && status.uac.prompts
  cards.push({
    id: 'uac',
    title: 'Permission prompts (UAC)',
    icon: PersonLockRegular,
    status: uacOk ? 'good' : 'attention',
    text: uacOk
      ? 'Windows asks before an app makes changes to the system.'
      : 'Windows doesn’t ask before apps make changes, so malware can change the system without you knowing. Raise the slider to the default level.',
    actions: uacOk ? [] : [{ label: 'UAC settings', run: page('uac'), accent: true }]
  })

  return cards
}

export function SecurityPage({ onNavigate }) {
  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState(null)
  const [updates, setUpdates] = useState(undefined)
  const [activated, setActivated] = useState(undefined)
  const [busy, setBusy] = useState(null)
  const [messages, setMessages] = useState({})

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await window.api.getSecurityStatus())
      setStatusError(null)
    } catch (err) {
      setStatusError(errorText(err, 'Couldn’t read the security settings.'))
    }
  }, [])

  const loadAll = useCallback(() => {
    setStatus(null)
    setUpdates(undefined)
    setActivated(undefined)
    setMessages({})
    loadStatus()
    window.api
      .runCheckup('updates')
      .then((r) => setUpdates(r?.ok ? r.data : null))
      .catch(() => setUpdates(null))
    window.api
      .getWindowsActivation()
      .then((a) => setActivated(a ?? null))
      .catch(() => setActivated(null))
  }, [loadStatus])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const FIXES = {
    update: {
      call: () => window.api.updateDefender(),
      running: 'Updating definitions…',
      done: 'Definitions updated.'
    },
    scan: {
      call: () => window.api.quickScan(),
      running: 'Scanning… This takes a few minutes; you can keep working.',
      done: 'Scan finished. If Defender found anything, it’s in Protection history.'
    },
    firewall: {
      call: () => window.api.turnOnFirewall(),
      running: 'Turning on the firewall… Windows may ask for permission.',
      done: 'The firewall is on.'
    },
    pua: {
      call: () => window.api.setPuaProtection(true),
      running: 'Turning on… Windows may ask for permission.',
      done: 'Unwanted apps are blocked now.'
    }
  }

  const fix = async (cardId, key) => {
    const f = FIXES[key]
    setBusy(key)
    setMessages((m) => ({ ...m, [cardId]: { text: f.running, running: true } }))
    const result = await f.call().catch((err) => ({ ok: false, error: errorText(err) }))
    const failure = actionError(result)
    setMessages((m) => ({
      ...m,
      [cardId]: failure ? { text: failure, failed: true } : { text: f.done }
    }))
    setBusy(null)
    await loadStatus()
  }

  const cards = buildCards({ status, updates, activated, onNavigate })
  const done = cards.filter((c) => c.status)
  const attention = done.filter((c) => c.status === 'attention').length
  const look = done.filter((c) => c.status === 'look').length
  const checking = cards.length - done.length

  return (
    <Page
      title="Security"
      description="Is this PC protected? Each part in plain words, with the fix."
    >
      <div className="flex flex-col gap-4">
        {statusError && (
          <InfoBar severity="warning" title="Couldn’t read the security settings">
            {statusError}
          </InfoBar>
        )}
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-cyan text-brand-carbon">
            {checking > 0 ? (
              <ProgressRing size={22} label="Checking" />
            ) : attention > 0 ? (
              <ErrorCircleFilled aria-hidden className="size-6" />
            ) : look > 0 ? (
              <WarningFilled aria-hidden className="size-6" />
            ) : (
              <CheckmarkCircleFilled aria-hidden className="size-6" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-brand text-[18px] leading-snug font-semibold">
              {checking > 0 && done.length === 0
                ? 'Checking how this PC is protected…'
                : attention > 0
                  ? `${attention === 1 ? '1 thing needs' : `${attention} things need`} your attention.`
                  : look > 0
                    ? `Protected, with ${look === 1 ? '1 thing' : `${look} things`} worth a look.`
                    : checking > 0
                      ? 'So far, so good.'
                      : 'This PC is well protected.'}
            </p>
            <p className="text-text-secondary">
              Reading only; nothing changes until you press a button.
            </p>
          </div>
          <Button
            icon={ArrowClockwiseRegular}
            disabled={checking > 0 || busy !== null}
            onClick={loadAll}
          >
            Check again
          </Button>
        </Card>

        <div className="@container">
          <div className="grid gap-3 @3xl:grid-cols-2">
            {cards.map((card) => (
              <SecurityCard
                key={card.id}
                card={card}
                message={messages[card.id]}
                busy={busy}
                onFix={(key) => fix(card.id, key)}
              />
            ))}
          </div>
        </div>
      </div>
    </Page>
  )
}

function SecurityCard({ card, message, busy, onFix }) {
  const Icon = card.icon
  const status = card.status ? STATUS[card.status] : null
  const StatusIcon = status?.icon
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-subtle-hover">
          <Icon aria-hidden className="size-5" />
        </span>
        <h2 className="min-w-0 flex-1 truncate font-brand text-[17px] font-semibold">
          {card.title}
        </h2>
        {status ? (
          <Badge tone={status.tone}>{status.label}</Badge>
        ) : (
          <ProgressRing label={`Checking ${card.title}`} />
        )}
      </div>
      <p className={cn('flex items-start gap-2', !status && 'text-text-secondary')}>
        {StatusIcon && (
          <StatusIcon aria-hidden className={cn('mt-0.5 size-4 shrink-0', status.color)} />
        )}
        <span className="min-w-0">{status ? card.text : (card.checkingText ?? 'Checking…')}</span>
      </p>
      {card.facts && (
        <dl className="ml-6 grid grid-cols-[max-content_1fr] gap-x-4 text-caption">
          {card.facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-secondary">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {message && (
        <p
          className={cn(
            'ml-6 inline-flex items-center gap-2 text-caption',
            message.failed ? 'text-text-primary' : 'text-text-secondary'
          )}
        >
          {message.running && <ProgressRing />}
          {message.text}
        </p>
      )}
      {status && card.actions?.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {card.actions.map((a) => (
            <Button
              key={a.label}
              variant={a.accent ? 'accent' : a.subtle ? 'subtle' : 'standard'}
              icon={a.icon}
              disabled={a.fix ? busy !== null : false}
              onClick={a.fix ? () => onFix(a.fix) : a.run}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </Card>
  )
}
