import { useCallback, useEffect, useState } from 'react'
import {
  Clock,
  Gauge,
  HardDrive,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  TriangleAlert
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const STATUS_LABEL = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
  unknown: 'Not available'
}

const ACCESS_DENIED_PATTERN = /access is denied|access denied|unauthorized|administrator|elevat/i
const STATUS_CLASS = {
  excellent: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400',
  good: 'border-emerald-900/50 bg-emerald-950/40 text-emerald-400',
  fair: 'border-amber-900/50 bg-amber-950/40 text-amber-400',
  poor: 'border-orange-900/50 bg-orange-950/40 text-orange-400',
  critical: 'border-red-900/50 bg-red-950/40 text-red-400',
  unknown: 'border-zinc-800 bg-zinc-900/60 text-zinc-400'
}

function StatCard({ icon: Icon2, label, value, hint }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon2 className="h-4 w-4 text-zinc-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardContent>
    </Card>
  )
}

function formatBytes(bytes) {
  if (bytes === null) return void 0
  const gb = bytes / 1024 ** 3
  return gb >= 1e3 ? `${(gb / 1024).toFixed(1)} TB` : `${Math.round(gb)} GB`
}

function formatPowerOnHours(hours) {
  if (hours === null) return '—'
  const days = Math.floor(hours / 24)
  return days > 0 ? `${hours} h (~${days} d)` : `${hours} h`
}

export function DiscoModule() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.getMainDiskHealth()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  const isInitialLoad = data === null
  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Disk Health</h1>
          <p className="text-sm text-zinc-500">
            {
              "WinDiag's own estimate of the main drive's remaining life, based on the storage reliability data Windows exposes natively."
            }
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          disabled={isLoading}
          onClick={() => void load()}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </header>
      {error && (
        <Card className="mb-4 border-red-900/50 bg-red-950/40">
          <CardContent className="py-4 text-sm text-red-400">
            {'Could not read disk health information: '}
            {error}
          </CardContent>
        </Card>
      )}
      {isInitialLoad && !error && (
        <p className="text-sm text-zinc-500">Reading disk health information…</p>
      )}
      {data && !data.supported && (
        <Card>
          <CardContent className="flex items-start gap-3 py-6 text-sm text-zinc-500">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p>Could not read reliability data for the main drive.</p>
              <p className="mt-1 text-xs text-zinc-500">
                {
                  "Some drives, controllers, or USB/RAID enclosures don't expose this through Windows' native Storage Reliability Counters — this isn't necessarily a sign of a problem."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {data && data.supported && (
        <>
          <Card className="mb-4">
            <CardHeader className="flex flex-row items-center gap-2">
              <HardDrive className="h-5 w-5 text-zinc-400" />
              <div>
                <CardTitle>{data.model ?? 'Main drive'}</CardTitle>
                <CardDescription>
                  {[data.mediaType, formatBytes(data.sizeBytes)].filter(Boolean).join(' · ') ||
                    'Model details not reported'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-zinc-500">Estimated health</p>
                <p className="text-3xl font-bold">
                  {data.healthPercent !== null ? `${data.healthPercent}%` : '—'}
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  STATUS_CLASS[data.healthStatus]
                )}
              >
                {STATUS_LABEL[data.healthStatus]}
              </span>
              {data.windowsHealthStatus && (
                <span className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs font-medium text-zinc-400">
                  {'Windows: '}
                  {data.windowsHealthStatus}
                </span>
              )}
            </CardContent>
          </Card>
          {data.reliabilityError && (
            <Card className="mb-4 border-amber-900/50 bg-amber-950/40">
              <CardContent className="flex items-start gap-3 py-4 text-sm text-amber-400">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>
                    {"Could not read the drive's reliability counters: "}
                    {data.reliabilityError}
                  </p>
                  {ACCESS_DENIED_PATTERN.test(data.reliabilityError) && (
                    <p className="mt-1 text-xs text-amber-400/80">
                      {
                        'This usually means reading it needs administrator rights. Close WinDiag and reopen it as Administrator (right-click the app → "Run as administrator"), then refresh this tab.'
                      }
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Gauge}
              label="Wear"
              value={data.wearPercent !== null ? `${data.wearPercent}%` : '—'}
              hint={
                data.wearPercent !== null
                  ? 'of rated write life used'
                  : 'Not reported by this drive'
              }
            />
            <StatCard
              icon={Thermometer}
              label="Temperature"
              value={data.temperatureC !== null ? `${data.temperatureC}°C` : '—'}
              hint={data.temperatureMaxC !== null ? `Max seen: ${data.temperatureMaxC}°C` : void 0}
            />
            <StatCard
              icon={Clock}
              label="Power-on time"
              value={formatPowerOnHours(data.powerOnHours)}
              hint={data.powerOnHours === null ? 'Not reported by this drive' : void 0}
            />
            <StatCard
              icon={ShieldAlert}
              label="Uncorrected errors"
              value={
                data.readErrorsUncorrected !== null && data.writeErrorsUncorrected !== null
                  ? String(data.readErrorsUncorrected + data.writeErrorsUncorrected)
                  : '—'
              }
              hint={
                data.readErrorsUncorrected !== null && data.writeErrorsUncorrected !== null
                  ? `${data.readErrorsUncorrected} read · ${data.writeErrorsUncorrected} write`
                  : 'Not reported by this drive'
              }
            />
          </div>
          <p className="text-xs text-zinc-500">{`This percentage is WinDiag's own estimate, inspired by the single "health %" summary tools like Hard Disk Sentinel show — it is not that same calculation (which is proprietary) and it is not a substitute for a full SMART reading. It's built from the drive's reported wear level, read/write error counts, and temperature, all sourced from Windows' built-in Storage Reliability Counters.`}</p>
        </>
      )}
    </div>
  )
}
