import { useMemo } from 'react'
import {
  BatteryCharging,
  BatteryFull,
  BatteryWarning,
  Gauge,
  HeartPulse,
  Plug,
  RotateCw,
  Zap
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSystemInfoContext } from '@/context/SystemInfoContext'
import { cn } from '@/lib/utils'

function BatteryChart({ samples }) {
  const width = 600
  const height = 160
  const padding = 8
  const points = useMemo(() => {
    if (samples.length < 2) return ''
    return samples
      .map((s, i) => {
        const x = (i / (samples.length - 1)) * (width - padding * 2) + padding
        const y = height - padding - (s.percent / 100) * (height - padding * 2)
        return `${x},${y}`
      })
      .join(' ')
  }, [samples])
  const areaPath = useMemo(() => {
    if (samples.length < 2) return ''
    const baseline = height - padding
    return `M${padding},${baseline} L${points} L${width - padding},${baseline} Z`
  }, [points, samples.length])
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" preserveAspectRatio="none">
      {[0, 25, 50, 75, 100].map((mark) => {
        const y = height - padding - (mark / 100) * (height - padding * 2)
        return (
          <g key={mark}>
            <line
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth={1}
              className="text-zinc-100"
            />
            <text x={2} y={y - 2} fontSize={9} className="fill-zinc-400">
              {mark}
            </text>
          </g>
        )
      })}
      {samples.length >= 2 && (
        <>
          <path d={areaPath} className="fill-emerald-500/10" />
          <polyline
            points={points}
            fill="none"
            className="stroke-emerald-500"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}
      {samples.length < 2 && (
        <text
          x={width / 2}
          y={height / 2}
          fontSize={12}
          textAnchor="middle"
          className="fill-zinc-400"
        >
          Collecting data…
        </text>
      )}
    </svg>
  )
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

function BatteryDeviceCard({ label, battery }) {
  const capacityHint =
    battery.maxCapacityMWh && battery.designedCapacityMWh
      ? `${battery.maxCapacityMWh} mWh of ${battery.designedCapacityMWh} mWh design`
      : 'Health not available'
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        {battery.isCharging ? (
          <BatteryCharging className="h-5 w-5 text-zinc-400" />
        ) : (
          <BatteryFull className="h-5 w-5 text-zinc-400" />
        )}
        <div>
          <CardTitle>{label}</CardTitle>
          <CardDescription>
            {[battery.manufacturer, battery.model].filter(Boolean).join(' · ') ||
              'Model not reported'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500">Charge</p>
          <p className="text-xl font-bold">{battery.percent}%</p>
          <p className="text-xs text-zinc-400">{battery.isCharging ? 'Charging' : 'On battery'}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Power source</p>
          <p className="text-xl font-bold">{battery.acConnected ? 'Plugged in' : 'On battery'}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Health</p>
          <p className="text-xl font-bold">
            {battery.healthPercent !== null ? `${battery.healthPercent}%` : '—'}
          </p>
          <p className="text-xs text-zinc-400">{capacityHint}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Cycles</p>
          <p className="text-xl font-bold">
            {battery.cycleCount !== null ? battery.cycleCount : '—'}
          </p>
          {battery.voltage !== null && (
            <p className="text-xs text-zinc-400">
              {(battery.voltage / 1e3).toFixed(2)}
              {' V'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function BateriaModule() {
  const { dynamicInfo, batterySamples: samples } = useSystemInfoContext()
  if (!dynamicInfo) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Battery</h1>
          <p className="text-sm text-zinc-500">Reading battery information…</p>
        </header>
      </div>
    )
  }
  const battery = dynamicInfo.battery
  const batteries = dynamicInfo.batteries
  const hasMultipleBatteries = batteries.length > 1
  if (!battery.hasBattery) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Battery</h1>
          <p className="text-sm text-zinc-500">
            Battery diagnostics: charge level, health and cycle count.
          </p>
        </header>
        <Card>
          <CardContent className="flex items-center gap-3 py-6 text-sm text-zinc-500">
            <BatteryWarning className="h-5 w-5" />
            {"This device does not report a battery (it's probably a desktop)."}
          </CardContent>
        </Card>
      </div>
    )
  }
  const healthLabel =
    battery.healthPercent !== null
      ? `${battery.healthPercent}% of design capacity`
      : 'Not available on this device'
  const capacityHint =
    battery.maxCapacityMWh && battery.designedCapacityMWh
      ? `${battery.maxCapacityMWh} mWh of ${battery.designedCapacityMWh} mWh design`
      : void 0
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Battery</h1>
        <p className="text-sm text-zinc-500">
          Real-time charge level, power connection status, and overall battery health.
          {hasMultipleBatteries &&
            ` This device has ${batteries.length} batteries — each is shown separately below.`}
        </p>
      </header>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={battery.isCharging ? BatteryCharging : BatteryFull}
          label={hasMultipleBatteries ? 'Combined charge' : 'Current charge'}
          value={`${battery.percent}%`}
          hint={battery.isCharging ? 'Charging' : 'On battery'}
        />
        <StatCard
          icon={Plug}
          label="Power source"
          value={battery.acConnected ? 'Plugged in' : 'On battery'}
          hint={
            battery.timeRemainingMinutes
              ? `≈ ${Math.round(battery.timeRemainingMinutes / 60)} h ${battery.timeRemainingMinutes % 60} min remaining`
              : 'Remaining time not available'
          }
        />
        <StatCard
          icon={HeartPulse}
          label="Battery health"
          value={battery.healthPercent !== null ? `${battery.healthPercent}%` : '—'}
          hint={capacityHint ?? healthLabel}
        />
        <StatCard
          icon={RotateCw}
          label="Charge cycles"
          value={battery.cycleCount !== null ? String(battery.cycleCount) : '—'}
          hint={battery.voltage !== null ? `${(battery.voltage / 1e3).toFixed(2)} V` : void 0}
        />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Gauge className="h-5 w-5 text-zinc-400" />
          <div>
            <CardTitle>Charge history</CardTitle>
            <CardDescription>
              {'Last '}
              {samples.length}
              {
                ' samples (every 5s). Leave the test running while you charge or discharge the device to verify the percentage progresses consistently.'
              }
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <BatteryChart samples={samples} />
        </CardContent>
      </Card>
      {hasMultipleBatteries && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-medium text-zinc-500">
            Individual batteries ({batteries.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {batteries.map((b, i) => (
              <BatteryDeviceCard key={b.id} label={`Battery ${i + 1}`} battery={b} />
            ))}
          </div>
        </div>
      )}
      {(battery.manufacturer || battery.model) && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
          <Zap className={cn('h-3.5 w-3.5')} />
          {[battery.manufacturer, battery.model].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}
