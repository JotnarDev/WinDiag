import { useMemo } from 'react'
import {
  Battery0Regular,
  Battery10Regular,
  Battery2Regular,
  Battery4Regular,
  Battery6Regular,
  Battery8Regular,
  BatteryCharge0Regular,
  BatteryCharge10Regular,
  BatteryCharge2Regular,
  BatteryCharge4Regular,
  BatteryCharge6Regular,
  BatteryCharge8Regular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Card, PropertyList, Section } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressBar, ProgressRing } from '@/components/ui/feedback'
import { useSystemInfoContext } from '@/context/SystemInfoContext'

// Icons are imported one by one (not `import *`) so only these get bundled
const BATTERY_ICONS = [
  Battery0Regular,
  Battery2Regular,
  Battery4Regular,
  Battery6Regular,
  Battery8Regular,
  Battery10Regular
]
const BATTERY_CHARGE_ICONS = [
  BatteryCharge0Regular,
  BatteryCharge2Regular,
  BatteryCharge4Regular,
  BatteryCharge6Regular,
  BatteryCharge8Regular,
  BatteryCharge10Regular
]

function BatteryIcon({ percent, charging, className }) {
  const level = Math.max(0, Math.min(5, Math.round(percent / 20)))
  const Icon = (charging ? BATTERY_CHARGE_ICONS : BATTERY_ICONS)[level]
  return <Icon aria-hidden className={className} />
}

function healthTone(percent) {
  if (percent === null) return 'neutral'
  if (percent >= 80) return 'success'
  if (percent >= 60) return 'caution'
  return 'critical'
}

const HEALTH_LABEL = {
  success: 'Good',
  caution: 'Worn',
  critical: 'Replace soon',
  neutral: 'Unknown'
}

function powerStatus(battery) {
  if (battery.isCharging) return 'Charging'
  if (battery.acConnected) return 'Plugged in, not charging'
  return 'On battery'
}

function timeRemaining(minutes) {
  if (!minutes) return null
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours} h ${minutes % 60} min remaining` : `${minutes} min remaining`
}

function capacityText(battery) {
  return battery.maxCapacityMWh && battery.designedCapacityMWh
    ? `${battery.maxCapacityMWh.toLocaleString()} of ${battery.designedCapacityMWh.toLocaleString()} mWh design capacity`
    : null
}

function StatCard({ label, value, detail, badge }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-secondary">{label}</span>
        {badge}
      </div>
      <span className="font-display text-title font-semibold">{value}</span>
      {detail && <span className="text-caption text-text-secondary">{detail}</span>}
    </Card>
  )
}

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
  if (samples.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-text-secondary">
        <ProgressRing size={16} label="Collecting data" />
        Collecting data…
      </div>
    )
  }
  return (
    <div className="flex gap-2">
      <div className="flex h-40 flex-col justify-between py-1 text-right text-caption text-text-tertiary">
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 min-w-0 flex-1"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Charge history: ${samples[0].percent}% to ${samples[samples.length - 1].percent}%`}
      >
        {[0, 25, 50, 75, 100].map((mark) => {
          const y = height - padding - (mark / 100) * (height - padding * 2)
          return (
            <line
              key={mark}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="var(--divider)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
        <path d={areaPath} fill="var(--accent-fill)" fillOpacity={0.12} />
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent-fill)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

export function BatteryModule() {
  const { dynamicInfo, batterySamples: samples } = useSystemInfoContext()
  const description = 'Live charge level, power source, wear and cycle count.'
  if (!dynamicInfo) {
    return (
      <Page title="Battery" description={description}>
        <Card className="flex items-center gap-3 px-4 py-5 text-text-secondary">
          <ProgressRing size={16} label="Reading battery" />
          Reading battery information…
        </Card>
      </Page>
    )
  }
  const battery = dynamicInfo.battery
  const batteries = dynamicInfo.batteries
  if (!battery.hasBattery) {
    return (
      <Page title="Battery" description={description}>
        <InfoBar severity="info">
          This device doesn&apos;t report a battery (it&apos;s probably a desktop).
        </InfoBar>
      </Page>
    )
  }
  const tone = healthTone(battery.healthPercent)
  const hasMultipleBatteries = batteries.length > 1
  return (
    <Page title="Battery" description={description}>
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5">
        <BatteryIcon
          percent={battery.percent}
          charging={battery.isCharging}
          className="size-12 shrink-0 text-accent-text"
        />
        <div className="min-w-48 flex-1">
          <p className="font-display text-title-large font-semibold">{battery.percent}%</p>
          <p className="text-text-secondary">
            {[powerStatus(battery), timeRemaining(battery.timeRemainingMinutes)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <ProgressBar
            label="Charge level"
            value={battery.percent}
            tone={battery.percent <= 15 && !battery.acConnected ? 'critical' : 'accent'}
            className="mt-3 max-w-sm"
          />
        </div>
        {hasMultipleBatteries && <Badge>{batteries.length} batteries combined</Badge>}
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Health"
          value={battery.healthPercent !== null ? `${battery.healthPercent}%` : '—'}
          detail={capacityText(battery) ?? 'Not reported on this device'}
          badge={battery.healthPercent !== null && <Badge tone={tone}>{HEALTH_LABEL[tone]}</Badge>}
        />
        <StatCard
          label="Charge cycles"
          value={battery.cycleCount !== null ? String(battery.cycleCount) : '—'}
          detail={battery.cycleCount === null ? 'Not reported on this device' : null}
        />
        <StatCard
          label="Voltage"
          value={battery.voltage !== null ? `${(battery.voltage / 1e3).toFixed(2)} V` : '—'}
          detail={[battery.manufacturer, battery.model].filter(Boolean).join(' · ') || null}
        />
      </div>

      <Section title="Charge history" className="mt-7">
        <Card className="p-5">
          <p className="mb-4 text-caption text-text-secondary">
            Last {samples.length} readings, every 5 seconds. Leave this page open while charging or
            discharging: the line should move steadily, without sudden jumps.
          </p>
          <BatteryChart samples={samples} />
        </Card>
      </Section>

      {hasMultipleBatteries && (
        <Section title="Individual batteries">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {batteries.map((b, i) => (
              <Card key={b.id} className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <BatteryIcon percent={b.percent} charging={b.isCharging} className="size-6" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Battery {i + 1}</p>
                    <p className="truncate text-caption text-text-secondary">
                      {[b.manufacturer, b.model].filter(Boolean).join(' · ') ||
                        'Model not reported'}
                    </p>
                  </div>
                  <span className="font-display text-subtitle font-semibold">{b.percent}%</span>
                </div>
                <PropertyList
                  items={[
                    ['Status', powerStatus(b)],
                    [
                      'Health',
                      b.healthPercent !== null
                        ? `${b.healthPercent}%${capacityText(b) ? ` (${capacityText(b)})` : ''}`
                        : null
                    ],
                    ['Cycles', b.cycleCount !== null ? String(b.cycleCount) : null],
                    ['Voltage', b.voltage !== null ? `${(b.voltage / 1e3).toFixed(2)} V` : null]
                  ]}
                />
              </Card>
            ))}
          </div>
        </Section>
      )}
    </Page>
  )
}
