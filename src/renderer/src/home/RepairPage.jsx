import { useEffect, useState } from 'react'
import {
  ArrowClockwiseRegular,
  ArrowCounterclockwiseRegular,
  ArrowSyncRegular,
  BroomRegular,
  DocumentCheckmarkRegular,
  FolderRegular,
  GlobeRegular,
  HistoryRegular,
  ShieldRegular,
  StoreMicrosoftRegular,
  WifiWarningRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ContentDialog, InfoBar, ProgressBar, ProgressRing } from '@/components/ui/feedback'
import { errorText } from './actions'

/*
 * Repair: the fixes a technician tries first, each with when to use it,
 * how long it takes and what it needs. One runs at a time; the long ones
 * show their progress and keep going if you leave the page.
 */

const GROUPS = [
  {
    title: 'Quick fixes',
    text: 'Safe and fast. Try these first.',
    items: [
      {
        id: 'explorer',
        icon: FolderRegular,
        title: 'Restart File Explorer',
        text: 'When the taskbar, Start or a folder window stops responding.',
        meta: ['A few seconds']
      },
      {
        id: 'flushDns',
        icon: GlobeRegular,
        title: 'Clear the DNS cache',
        text: 'When one website doesn’t open but others do, or a site moved and your PC still looks for the old one.',
        meta: ['A second']
      },
      {
        id: 'store',
        icon: StoreMicrosoftRegular,
        title: 'Reset the Microsoft Store cache',
        text: 'When the Store won’t open, or apps from it won’t download or update.',
        meta: ['A few seconds']
      }
    ]
  },
  {
    title: 'Repair Windows',
    text: 'For problems that keep coming back.',
    items: [
      {
        id: 'systemFiles',
        icon: DocumentCheckmarkRegular,
        title: 'Repair system files',
        text: 'When Windows crashes, apps that come with Windows won’t open, or updates keep failing. Windows checks its own files and fixes the damaged ones (DISM and SFC).',
        meta: ['15 to 30 minutes', 'Asks for permission'],
        long: true
      },
      {
        id: 'windowsUpdate',
        icon: ArrowSyncRegular,
        title: 'Reset Windows Update',
        text: 'When updates are stuck downloading or fail with the same error again and again. Windows Update starts fresh and downloads what it needs again.',
        meta: ['About a minute', 'Asks for permission']
      },
      {
        id: 'network',
        icon: WifiWarningRegular,
        title: 'Reset the network',
        text: 'When you’re connected but nothing loads, on any website. Resets Windows’ network settings to how they were installed; Wi-Fi networks and passwords are kept.',
        meta: ['A few seconds', 'Asks for permission', 'Needs a restart']
      }
    ]
  },
  {
    title: 'Restore points',
    text: 'A snapshot of Windows’ settings, apps and drivers, to go back to if something breaks. Your files aren’t affected.',
    items: [
      {
        id: 'restorePoint',
        icon: ShieldRegular,
        title: 'Create a restore point',
        text: 'Before installing a driver or an app you’re unsure about, or changing a setting you don’t know.',
        meta: ['About a minute', 'Asks for permission']
      },
      {
        id: 'systemRestore',
        icon: HistoryRegular,
        title: 'Go back to a restore point',
        text: 'When something broke after an update, a driver or an app. Opens Windows’ System Restore, where you choose the point; apps installed after it are removed.',
        meta: ['Asks for permission'],
        opens: true
      }
    ]
  }
]

const PHASE_TEXT = {
  dism: 'Step 1 of 2: repairing Windows’ copy of its files',
  sfc: 'Step 2 of 2: checking every system file'
}

export function RepairPage() {
  const [job, setJob] = useState(null)
  const [startError, setStartError] = useState(null)
  const [confirmRestart, setConfirmRestart] = useState(false)

  useEffect(() => {
    window.api
      .getRepairJob()
      .then((j) => j && setJob(j))
      .catch(() => {})
    return window.api.onRepairProgress(setJob)
  }, [])

  const running = Boolean(job && !job.done)

  const run = async (id) => {
    setStartError(null)
    if (id === 'systemRestore') {
      await window.api
        .openSystemRestore()
        .catch((err) =>
          setStartError({ id, text: errorText(err, 'Couldn’t open System Restore.') })
        )
      return
    }
    try {
      setJob(await window.api.runRepair(id))
    } catch (err) {
      setStartError({ id, text: errorText(err, 'Couldn’t start.') })
    }
  }

  return (
    <Page title="Repair" description="Fix common Windows problems, starting with the safest.">
      <div className="flex flex-col gap-6">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="font-brand text-subtitle font-semibold">{group.title}</h2>
            <p className="mb-2 text-text-secondary">{group.text}</p>
            <Card className="divide-y divide-card-stroke">
              {group.items.map((item) => (
                <RepairRow
                  key={item.id}
                  item={item}
                  job={
                    job &&
                    (job.id === item.id ||
                      (item.id === 'restorePoint' && job.id === 'restorePointEnable'))
                      ? job
                      : null
                  }
                  disabled={running}
                  startError={startError?.id === item.id ? startError.text : null}
                  onRun={run}
                  onRestart={() => setConfirmRestart(true)}
                />
              ))}
            </Card>
          </section>
        ))}
        <p className="text-caption text-text-secondary">
          If a repair fails, the details are in the error log (Settings → Troubleshooting).
        </p>
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
        Save your work and close your apps first. Windows restarts a few seconds after you confirm.
      </ContentDialog>
    </Page>
  )
}

function RepairRow({ item, job, disabled, startError, onRun, onRestart }) {
  const Icon = item.icon
  const running = job && !job.done
  const result = job?.done ? job.result : null

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-subtle-hover">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.title}</p>
          <p className="text-text-secondary">{item.text}</p>
          <p className="mt-1 text-caption text-text-secondary">{item.meta.join(' · ')}</p>
        </div>
        {running ? (
          <ProgressRing label={`Running ${item.title}`} />
        ) : (
          <Button
            icon={
              item.opens
                ? ArrowCounterclockwiseRegular
                : item.id === 'store'
                  ? BroomRegular
                  : undefined
            }
            disabled={disabled}
            onClick={() => onRun(item.id)}
          >
            {item.opens ? 'Open System Restore' : result ? 'Run again' : 'Run'}
          </Button>
        )}
      </div>

      {running && (
        <div className="ml-13 flex flex-col gap-2">
          {item.long ? (
            <>
              <p className="text-text-secondary">
                {job.phase
                  ? `${PHASE_TEXT[job.phase] ?? 'Working'}${job.percent != null ? ` · ${job.percent}%` : '…'}`
                  : 'Allow WinDiag to make changes when Windows asks.'}
              </p>
              {job.phase && (
                <ProgressBar value={job.percent ?? 0} label={PHASE_TEXT[job.phase] ?? 'Progress'} />
              )}
              <p className="text-caption text-text-secondary">
                You can keep working or leave this page. Don’t restart until it ends.
              </p>
            </>
          ) : (
            <p className="text-text-secondary">Working… Windows may ask for permission.</p>
          )}
        </div>
      )}

      {result && !result.cancelled && (
        <InfoBar
          severity={result.ok ? 'success' : 'warning'}
          title={result.ok ? result.title : 'It didn’t work'}
          className="ml-13"
          action={
            result.restart ? (
              <Button icon={ArrowClockwiseRegular} onClick={onRestart}>
                Restart now
              </Button>
            ) : result.protectionOff ? (
              <Button disabled={disabled} onClick={() => onRun('restorePointEnable')}>
                Turn on System Protection and try again
              </Button>
            ) : null
          }
        >
          {result.ok ? result.text : result.error}
        </InfoBar>
      )}
      {result?.cancelled && (
        <p className="ml-13 text-caption text-text-secondary">
          Nothing changed: Windows didn’t get permission.
        </p>
      )}
      {startError && (
        <InfoBar severity="warning" title="Couldn’t start" className="ml-13">
          {startError}
        </InfoBar>
      )}
    </div>
  )
}
