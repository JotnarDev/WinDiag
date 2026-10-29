import { useCallback, useEffect, useState } from 'react'
import { ArrowSyncRegular, HardDriveRegular, ShieldKeyholeRegular } from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressBar, ProgressRing } from '@/components/ui/feedback'

const STATUS = {
  excellent: { label: 'Excellent', tone: 'success' },
  good: { label: 'Good', tone: 'success' },
  fair: { label: 'Fair', tone: 'caution' },
  poor: { label: 'Poor', tone: 'critical' },
  critical: { label: 'Critical', tone: 'critical' },
  unknown: { label: 'Not available', tone: 'neutral' }
}

function formatBytes(bytes) {
  if (bytes === null) return undefined
  const gb = bytes / 1024 ** 3
  return gb >= 1e3 ? `${(gb / 1024).toFixed(1)} TB` : `${Math.round(gb)} GB`
}

function formatPowerOnHours(hours) {
  if (hours === null) return '—'
  const days = Math.floor(hours / 24)
  return days > 0 ? `${hours.toLocaleString()} h` : `${hours} h`
}

function StatCard({ label, value, detail }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-text-secondary">{label}</span>
      <span className="font-display text-title font-semibold">{value}</span>
      {detail && <span className="text-caption text-text-secondary">{detail}</span>}
    </Card>
  )
}

export function DiskModule() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await window.api.getMainDiskHealth())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  const status = STATUS[data?.healthStatus] ?? STATUS.unknown
  const hasErrorCounts = data?.readErrorsUncorrected != null && data?.writeErrorsUncorrected != null
  return (
    <Page
      title="Disk health"
      description="An estimate of the main drive's remaining life, from the reliability data Windows exposes natively."
      actions={
        <Button icon={ArrowSyncRegular} disabled={isLoading} onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      {error && (
        <InfoBar severity="error" title="Couldn't read disk health." className="mb-4">
          {error}
        </InfoBar>
      )}
      {data === null && !error && (
        <Card className="flex items-center gap-3 px-4 py-5 text-text-secondary">
          <ProgressRing size={16} label="Reading disk health" />
          Reading disk health information…
        </Card>
      )}
      {data && !data.supported && (
        <InfoBar severity="warning" title="Couldn't read reliability data for the main drive.">
          Some drives, controllers and USB or RAID enclosures don&apos;t expose Windows&apos;
          Storage Reliability Counters. This isn&apos;t necessarily a sign of a problem.
        </InfoBar>
      )}
      {data?.supported && (
        <>
          <Card className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5">
            <HardDriveRegular aria-hidden className="size-12 shrink-0 text-accent-text" />
            <div className="min-w-48 flex-1">
              <p className="selectable font-display text-subtitle font-semibold">
                {data.model ?? 'Main drive'}
              </p>
              <p className="text-text-secondary">
                {[data.mediaType, formatBytes(data.sizeBytes)].filter(Boolean).join(' · ') ||
                  'Model details not reported'}
              </p>
              {data.windowsHealthStatus && (
                <p className="mt-1 text-caption text-text-secondary">
                  Windows reports: {data.windowsHealthStatus}
                </p>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-56">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-title-large font-semibold">
                  {data.healthPercent !== null ? `${data.healthPercent}%` : '—'}
                </span>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <ProgressBar
                label="Estimated health"
                value={data.healthPercent ?? 0}
                tone={status.tone === 'neutral' ? 'accent' : status.tone}
              />
              <span className="text-caption text-text-secondary">Estimated health</span>
            </div>
          </Card>

          {data.reliabilityError && (
            <InfoBar
              severity="warning"
              title="Couldn't read the drive's reliability counters."
              className="mt-3"
              action={
                data.isElevated === false && (
                  <Button
                    icon={ShieldKeyholeRegular}
                    onClick={() => void window.api.relaunchAsAdmin()}
                  >
                    Run as administrator
                  </Button>
                )
              }
            >
              {data.reliabilityError}
              {data.isElevated === false && ' Reading them usually needs administrator rights.'}
            </InfoBar>
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Wear"
              value={data.wearPercent !== null ? `${data.wearPercent}%` : '—'}
              detail={
                data.wearPercent !== null
                  ? 'of rated write life used'
                  : 'Not reported by this drive'
              }
            />
            <StatCard
              label="Temperature"
              value={data.temperatureC !== null ? `${data.temperatureC} °C` : '—'}
              detail={
                data.temperatureMaxC !== null ? `Highest seen: ${data.temperatureMaxC} °C` : null
              }
            />
            <StatCard
              label="Power-on time"
              value={formatPowerOnHours(data.powerOnHours)}
              detail={
                data.powerOnHours === null
                  ? 'Not reported by this drive'
                  : data.powerOnHours >= 24
                    ? `About ${Math.floor(data.powerOnHours / 24).toLocaleString()} days`
                    : null
              }
            />
            <StatCard
              label="Uncorrected errors"
              value={
                hasErrorCounts
                  ? String(data.readErrorsUncorrected + data.writeErrorsUncorrected)
                  : '—'
              }
              detail={
                hasErrorCounts
                  ? `${data.readErrorsUncorrected} read · ${data.writeErrorsUncorrected} write`
                  : 'Not reported by this drive'
              }
            />
          </div>
          <p className="mt-6 text-caption text-text-tertiary">
            The health percentage is WinDiag&apos;s own estimate, in the spirit of the single
            &quot;health %&quot; that tools like Hard Disk Sentinel show (not the same, proprietary,
            calculation) and not a substitute for a full S.M.A.R.T. reading. It combines the
            drive&apos;s reported wear, read/write error counts and temperature from Windows&apos;
            built-in Storage Reliability Counters.
          </p>
        </>
      )}
    </Page>
  )
}
