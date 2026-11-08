import { useEffect, useId, useState } from 'react'
import {
  ArrowRightRegular,
  ArrowSyncRegular,
  Battery6Regular,
  CheckmarkCircleFilled,
  CheckmarkRegular,
  ChevronDownRegular,
  CircleHalfFillRegular,
  CopyRegular,
  DeveloperBoardLightningRegular,
  DeveloperBoardRegular,
  DeveloperBoardSearchRegular,
  DismissCircleFilled,
  KeyRegular,
  RamRegular,
  SettingsRegular,
  ShieldCheckmarkRegular,
  StorageRegular,
  SubtractCircleRegular,
  WarningFilled,
  WindowRegular
} from '@fluentui/react-icons'
import { BENCH_NAV } from '@/bench/nav'
import { Button } from '@/components/ui/Button'
import { Card, PropertyList } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressBar, ProgressRing } from '@/components/ui/feedback'
import { useSystemInfoContext } from '@/context/SystemInfoContext'
import { resolveTestResult, useTestResults } from '@/context/TestResultsContext'
import { cn } from '@/lib/utils'

// The gamepad tester checks an accessory, not the PC, so it isn't counted
const HARDWARE_TESTS = BENCH_NAV.find((group) => group.header === 'Hardware tests').items.filter(
  (item) => item.id !== 'gamepad'
)

const GPU_KIND_LABELS = {
  integrated: 'Integrated',
  dedicated: 'Dedicated',
  'no-driver': 'No driver installed',
  unknown: 'Type unknown'
}

// Every status is shown with an icon and a word, never by colour alone
const STATUS = {
  pass: {
    label: 'Passed',
    icon: CheckmarkCircleFilled,
    text: 'text-success',
    ring: 'var(--success)'
  },
  check: { label: 'Check', icon: WarningFilled, text: 'text-caution', ring: 'var(--caution)' },
  fail: {
    label: 'Failed',
    icon: DismissCircleFilled,
    text: 'text-critical',
    ring: 'var(--critical)'
  },
  progress: {
    label: 'In progress',
    icon: CircleHalfFillRegular,
    text: 'text-accent-text',
    ring: 'var(--accent-fill-tertiary)'
  },
  todo: {
    label: 'Not tested',
    icon: SubtractCircleRegular,
    text: 'text-text-tertiary',
    ring: null
  },
  absent: {
    label: 'Not present',
    icon: SubtractCircleRegular,
    text: 'text-text-tertiary',
    ring: null
  }
}

const WU_LABELS = {
  default: {
    title: 'Windows Update: Windows default',
    detail: 'Installs every update and driver it finds.'
  },
  security: {
    title: 'Windows Update: security only',
    detail: 'No drivers, feature updates wait a year.'
  },
  disabled: {
    title: 'Windows Update is off',
    detail: 'No updates or drivers, even after a restart.'
  },
  unknown: { title: 'Windows Update', detail: "Couldn't read its current mode." }
}

const formatKB = (kb) =>
  kb === null || kb === undefined ? null : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
const formatVram = (mb) => (mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`)
const formatGB = (gb) => (gb >= 1000 ? `${(gb / 1024).toFixed(1)} TB` : `${Math.round(gb)} GB`)
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`
const join = (parts, separator = ' · ') => parts.filter(Boolean).join(separator)

function activationLabel(activated) {
  if (activated === true) return 'Activated'
  if (activated === false) return 'Not activated'
  if (activated === undefined) return 'Checking activation…'
  return 'Activation unknown'
}

function gpuVram(gpu) {
  if (gpu.kind === 'integrated') return 'Shared with system RAM'
  return gpu.vramMB ? formatVram(gpu.vramMB) : null
}

function cacheSummary(cache) {
  const l1 = formatKB(cache.l1dKB ?? cache.l1iKB)
  const l2 = formatKB(cache.l2KB)
  const l3 = formatKB(cache.l3KB)
  return join([l1 && `L1 ${l1}`, l2 && `L2 ${l2}`, l3 && `L3 ${l3}`]) || null
}

// Plain-text version of the spec sheet for the clipboard (tickets, notes)
function specsAsText(info) {
  return [
    `Device: ${join([info.device.manufacturer, info.device.model], ' ') || '—'}${
      info.device.modelId ? ` (${info.device.modelId})` : ''
    }`,
    `Serial number: ${info.device.serialNumber ?? '—'}`,
    `Processor: ${info.cpu.brand} (${info.cpu.physicalCores} cores / ${info.cpu.cores} threads, ${info.cpu.baseSpeedGHz} GHz)`,
    `RAM: ${info.memory.totalGB} GB (${plural(info.memory.moduleCount, 'module', 'modules')})`,
    ...info.storage.disks.map(
      (d) =>
        `Disk: ${join([d.name, `${d.capacityGB} GB`, d.type, d.serialNumber && `S/N ${d.serialNumber}`])}`
    ),
    ...info.gpus.map((g) => `Graphics: ${g.name} (${GPU_KIND_LABELS[g.kind]})`),
    `Battery: ${info.battery ? join([info.battery.manufacturer, info.battery.model], ' ') || 'Present' : 'None'}`,
    `BIOS: ${join([info.bios.vendor, info.bios.version], ' ') || '—'}`,
    `Windows: ${join([info.os.name, info.os.version, info.os.build && `build ${info.os.build}`, activationLabel(info.os.activated)])}`
  ].join('\n')
}

function CopySpecsButton({ info }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(specsAsText(info))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Button
      variant="subtle"
      icon={copied ? CheckmarkRegular : CopyRegular}
      onClick={() => void handleCopy()}
    >
      {copied ? 'Copied' : 'Copy specs'}
    </Button>
  )
}

/* ------------------------------------------------------------------ device -- */

// A flat drawing of the kind of device, in the brand's colours
function DeviceArt({ kind }) {
  const screen = (
    <>
      <rect x="52" y="28" width="40" height="40" rx="9" fill="#22E3F2" />
      <rect x="57" y="32" width="30" height="27" rx="6" fill="#141619" />
      <path
        d="M62 38l3.5 14h3l3.5-9 3.5 9h3l3.5-14"
        stroke="#F4F5F6"
        strokeWidth="3.2"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="102" y="32" width="80" height="6" rx="3" fill="#F4F5F6" opacity=".9" />
      <rect x="102" y="44" width="56" height="5" rx="2.5" fill="#F4F5F6" opacity=".35" />
      <rect x="52" y="82" width="136" height="4" rx="2" fill="#F4F5F6" opacity=".15" />
      <rect x="52" y="82" width="96" height="4" rx="2" fill="#9BE15D" />
      <rect x="52" y="92" width="136" height="4" rx="2" fill="#F4F5F6" opacity=".15" />
      <rect x="52" y="92" width="122" height="4" rx="2" fill="#9BE15D" />
    </>
  )
  return (
    <svg viewBox="0 0 240 150" aria-hidden className="w-full max-w-[220px]">
      <rect x="30" y="6" width="180" height="114" rx="7" fill="#141619" />
      <rect x="39" y="15" width="162" height="96" rx="3" fill="#1b1e22" />
      {screen}
      {kind === 'laptop' ? (
        <>
          <path d="M8 124h224l-9 15H17z" fill="#141619" />
          <rect x="100" y="124" width="40" height="4" rx="2" fill="#2a2e34" />
        </>
      ) : (
        <>
          <rect x="108" y="120" width="24" height="14" fill="#141619" />
          <rect x="78" y="134" width="84" height="7" rx="3.5" fill="#141619" />
        </>
      )}
    </svg>
  )
}

function LiveStat({ label, value, unit, percent }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-caption text-text-secondary">{label}</p>
      <p className="mt-0.5 mb-2 truncate font-brand text-[22px] leading-8 font-semibold tabular-nums @4xl:text-[26px]">
        {value}
        {unit && (
          <span className="ml-1 font-sans text-caption font-normal text-text-secondary">
            {unit}
          </span>
        )}
      </p>
      <ProgressBar label={label} value={percent} />
    </div>
  )
}

function DeviceStage({ info, live, isLoading, onRefresh }) {
  const { device } = info
  const hasBattery = Boolean(info.battery)
  const battery = live?.battery
  const name = device.model ?? 'Model not reported'
  return (
    <Card className="grid overflow-hidden @3xl:grid-cols-[minmax(220px,300px)_1fr]">
      <div className="flex flex-col items-center justify-center gap-3 bg-brand-cyan px-6 py-6 text-brand-carbon">
        <DeviceArt kind={hasBattery ? 'laptop' : 'desktop'} />
        <span className="self-start text-caption font-semibold opacity-75">
          {hasBattery ? 'Laptop' : 'Desktop'}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-5 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-text-secondary">
              {device.manufacturer ?? 'Manufacturer not reported'}
            </p>
            <h1 className="selectable font-brand text-[36px] leading-[1.1] font-semibold tracking-[-0.01em]">
              {name}
            </h1>
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-text-secondary">
              <span>
                Serial number{' '}
                <span className="selectable font-semibold text-text-primary">
                  {device.serialNumber ?? 'Not available'}
                </span>
              </span>
              {device.modelId && (
                <span>
                  Model ID{' '}
                  <span className="selectable font-semibold text-text-primary">
                    {device.modelId}
                  </span>
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-1">
            <CopySpecsButton info={info} />
            <Button
              variant="subtle"
              icon={ArrowSyncRegular}
              onClick={onRefresh}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        </div>
        <div
          className={cn(
            'mt-auto grid grid-cols-2 gap-x-6 gap-y-4 border-t border-divider pt-4',
            hasBattery ? '@2xl:grid-cols-4' : '@2xl:grid-cols-3'
          )}
        >
          {live ? (
            <>
              <LiveStat
                label="Processor load"
                value={live.cpu.loadPercent}
                unit="%"
                percent={live.cpu.loadPercent}
              />
              <LiveStat
                label="Memory in use"
                value={live.memory.usedGB}
                unit={`of ${info.memory.totalGB} GB`}
                percent={live.memory.usedPercent}
              />
              {live.storage && (
                <LiveStat
                  label={`Main drive · ${live.storage.usedPercent} % used`}
                  value={formatGB(live.storage.usedGB)}
                  percent={live.storage.usedPercent}
                />
              )}
              {hasBattery && battery?.hasBattery && (
                <LiveStat
                  label={battery.acConnected ? 'Battery · plugged in' : 'Battery · on battery'}
                  value={battery.percent}
                  unit="%"
                  percent={battery.percent}
                />
              )}
            </>
          ) : (
            <p className="col-span-full flex items-center gap-3 text-text-secondary">
              <ProgressRing size={16} label="Reading live values" />
              Reading live values…
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------- tests -- */

// Battery is judged from its health; touch is "not present" without a touchscreen
function testState(id, results, live) {
  const resolved = resolveTestResult(results[id])
  if (resolved.status !== 'todo') return resolved
  if (id === 'battery' && live?.battery) {
    const { hasBattery, healthPercent } = live.battery
    if (!hasBattery) return { status: 'absent', note: 'No battery' }
    if (healthPercent !== null) {
      const status = healthPercent >= 80 ? 'pass' : healthPercent >= 60 ? 'check' : 'fail'
      return { status, note: `Health ${healthPercent} %` }
    }
  }
  if (id === 'touch' && navigator.maxTouchPoints === 0)
    return { status: 'absent', note: 'No touchscreen' }
  return resolved
}

function TestRing({ states }) {
  const r = 26
  const c = 2 * Math.PI * r
  const segment = c / states.length
  const gap = 4
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="size-16 shrink-0 -rotate-90">
      {states.map((state, i) => (
        <circle
          key={i}
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          stroke={STATUS[state.status].ring ?? 'var(--divider)'}
          strokeDasharray={`${segment - gap} ${c - segment + gap}`}
          strokeDashoffset={-i * segment}
        />
      ))}
    </svg>
  )
}

function TestsCard({ live, onNavigate }) {
  const results = useTestResults()
  const tests = HARDWARE_TESTS.map((test) => ({ ...test, ...testState(test.id, results, live) }))
  const count = (status) => tests.filter((t) => t.status === status).length
  const relevant = tests.filter((t) => t.status !== 'absent')
  const next = tests.find((t) => t.status === 'todo' || t.status === 'progress')
  const summary = join([
    count('check') && `${count('check')} to check`,
    count('fail') && `${count('fail')} failed`,
    `${relevant.length - count('pass') - count('check') - count('fail')} left`
  ])
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-brand text-subtitle font-semibold">Hardware tests</h2>
        <span className="flex-1" />
        {next && (
          <Button variant="subtle" className="text-accent-text" onClick={() => onNavigate(next.id)}>
            Continue: {next.label}
            <ArrowRightRegular aria-hidden className="size-4" />
          </Button>
        )}
      </div>
      <div className="mb-4 flex items-center gap-4">
        <TestRing states={tests} />
        <div>
          <p className="font-brand text-[28px] leading-none font-semibold tabular-nums">
            {count('pass')}/{relevant.length}
          </p>
          <p className="mt-1 text-text-secondary">passed · {summary}</p>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 @lg:grid-cols-2">
        {tests.map((test) => {
          const status = STATUS[test.status]
          const Icon = test.icon
          const StatusIcon = status.icon
          return (
            <li key={test.id}>
              <button
                type="button"
                onClick={() => onNavigate(test.id)}
                className="flex w-full items-center gap-3 rounded-control bg-control-alt px-3 py-2 text-left hover:bg-subtle-hover active:bg-subtle-pressed"
              >
                <Icon aria-hidden className="size-[18px] shrink-0 text-text-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{test.label}</span>
                  <span className="block truncate text-caption text-text-secondary">
                    {test.note ?? status.label}
                  </span>
                </span>
                <StatusIcon
                  aria-label={status.label}
                  className={cn('size-4 shrink-0', status.text)}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------- specs -- */

function SubItem({ title, items }) {
  return (
    <div className="border-t border-divider pt-3 first:border-t-0 first:pt-0">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <PropertyList items={items} />
    </div>
  )
}

function SpecRow({ icon: Icon, label, value, badge, children }) {
  const [open, setOpen] = useState(false)
  const contentId = useId()
  return (
    <li className="border-t border-divider first:border-t-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((v) => !v)}
          className="-mx-2 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-control px-2 text-left hover:bg-subtle-hover"
        >
          <Icon aria-hidden className="size-[18px] shrink-0 text-text-secondary" />
          <span className="w-[84px] shrink-0 text-text-secondary">{label}</span>
          <span className="min-w-0 flex-1 truncate">{value}</span>
          <ChevronDownRegular
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-text-secondary transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </button>
        {badge}
      </div>
      {open && (
        <div id={contentId} className="flex flex-col gap-3 pt-1 pb-4 pl-[30px]">
          {children}
        </div>
      )}
    </li>
  )
}

function SpecsCard({ info }) {
  const { cpu, memory, storage, gpus, battery, bios, os } = info
  const mainGpu = gpus.find((g) => g.kind === 'dedicated') ?? gpus[0]
  const activationTone =
    os.activated === true ? 'success' : os.activated === false ? 'critical' : 'neutral'
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <h2 className="mb-2 font-brand text-subtitle font-semibold">Specifications</h2>
      <ul className="flex flex-col">
        <SpecRow
          icon={DeveloperBoardRegular}
          label="Processor"
          value={
            <>
              <b className="font-semibold">{cpu.brand}</b> · {cpu.physicalCores}C/{cpu.cores}T ·{' '}
              {cpu.baseSpeedGHz} GHz
            </>
          }
        >
          <PropertyList
            items={[
              ['Manufacturer', cpu.manufacturer],
              ['Cores / threads', `${cpu.physicalCores} / ${cpu.cores}`],
              ['Base speed', `${cpu.baseSpeedGHz} GHz`],
              ['Max speed', cpu.maxSpeedGHz !== null ? `${cpu.maxSpeedGHz} GHz` : null],
              ['Socket', cpu.socket],
              ['Family / model', join([cpu.family, cpu.model], ' / ') || null],
              ['Cache', cacheSummary(cpu.cache)]
            ]}
          />
        </SpecRow>
        <SpecRow
          icon={RamRegular}
          label="Memory"
          value={
            <>
              <b className="font-semibold">{memory.totalGB} GB</b> ·{' '}
              {join([memory.modules[0]?.type, plural(memory.moduleCount, 'module', 'modules')])}
            </>
          }
        >
          {memory.modules.length === 0 ? (
            <p className="text-text-secondary">
              The system didn&apos;t report the installed modules.
            </p>
          ) : (
            memory.modules.map((m, i) => (
              <SubItem
                key={i}
                title={`${m.bank ?? `Module ${i + 1}`} · ${m.capacityGB} GB`}
                items={[
                  ['Type', m.type],
                  ['Speed', m.speedMHz ? `${m.speedMHz} MHz` : null],
                  ['Manufacturer', m.manufacturer],
                  ['Part number', m.partNumber],
                  ['Serial number', m.serialNumber]
                ]}
              />
            ))
          )}
        </SpecRow>
        <SpecRow
          icon={StorageRegular}
          label="Storage"
          value={
            storage.disks.length === 0 ? (
              'No physical disks detected'
            ) : (
              <>
                <b className="font-semibold">{formatGB(storage.totalGB)}</b> ·{' '}
                {join([
                  storage.disks[0].type,
                  storage.disks.length > 1 && plural(storage.disks.length, 'disk', 'disks')
                ])}
              </>
            )
          }
        >
          {storage.disks.map((d, i) => (
            <SubItem
              key={i}
              title={`${d.name} · ${d.capacityGB} GB`}
              items={[
                ['Type', d.type],
                ['Interface', d.interfaceType],
                ['Manufacturer', d.vendor],
                ['Serial number', d.serialNumber],
                ['S.M.A.R.T. status', d.smartStatus]
              ]}
            />
          ))}
        </SpecRow>
        <SpecRow
          icon={DeveloperBoardLightningRegular}
          label="Graphics"
          value={
            mainGpu ? (
              <>
                <b className="font-semibold">{mainGpu.name}</b>
                {gpus.length > 1
                  ? ` · + ${gpus.length - 1} more`
                  : ` · ${GPU_KIND_LABELS[mainGpu.kind]}`}
              </>
            ) : (
              'No graphics adapter reported'
            )
          }
        >
          {gpus.map((g, i) => (
            <SubItem
              key={i}
              title={g.name}
              items={[
                ['Type', GPU_KIND_LABELS[g.kind]],
                ['Manufacturer', g.vendor],
                ['Video memory', gpuVram(g)],
                ['Driver version', g.driverVersion]
              ]}
            />
          ))}
        </SpecRow>
        <SpecRow
          icon={Battery6Regular}
          label="Battery"
          value={
            battery
              ? join([battery.manufacturer ?? 'Manufacturer not reported', battery.chemistry])
              : 'No battery'
          }
        >
          {battery ? (
            <PropertyList
              items={[
                ['Manufacturer', battery.manufacturer],
                ['Model', battery.model],
                ['Serial number', battery.serialNumber],
                ['Chemistry', battery.chemistry],
                [
                  'Design capacity',
                  battery.designedCapacityMWh ? `${battery.designedCapacityMWh} mWh` : null
                ]
              ]}
            />
          ) : (
            <p className="text-text-secondary">This device doesn&apos;t report a battery.</p>
          )}
        </SpecRow>
        <SpecRow
          icon={SettingsRegular}
          label="BIOS"
          value={
            <>
              <b className="font-semibold">{bios.version ?? 'Version not reported'}</b>
              {bios.vendor && ` · ${bios.vendor}`}
            </>
          }
        >
          <PropertyList
            items={[
              ['Manufacturer', bios.vendor],
              ['Version', bios.version],
              ['Release date', bios.releaseDate]
            ]}
          />
        </SpecRow>
        <SpecRow
          icon={WindowRegular}
          label="Windows"
          value={
            <>
              <b className="font-semibold">{os.name ?? 'Windows'}</b>
              {os.version && ` · ${os.version}`}
            </>
          }
          badge={<Badge tone={activationTone}>{activationLabel(os.activated)}</Badge>}
        >
          <PropertyList
            items={[
              ['Edition', os.name],
              ['Version', os.version],
              ['OS build', os.build],
              ['Architecture', os.architecture],
              ['Activation', activationLabel(os.activated)]
            ]}
          />
        </SpecRow>
      </ul>
    </Card>
  )
}

/* -------------------------------------------------------------- next steps -- */

function NextStep({ icon: Icon, title, detail, action }) {
  return (
    <Card className="flex items-center gap-4 px-5 py-4">
      <Icon aria-hidden className="size-6 shrink-0 text-text-secondary" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-caption text-text-secondary">{detail}</p>
      </div>
      {action}
    </Card>
  )
}

function NextSteps({ info, onNavigate }) {
  const [wuState, setWuState] = useState(null)
  useEffect(() => {
    let cancelled = false
    window.api
      .getWindowsUpdateState()
      .then((state) => !cancelled && setWuState(state))
      .catch(() => !cancelled && setWuState({ mode: 'unknown' }))
    return () => {
      cancelled = true
    }
  }, [])
  const activated = info.os.activated
  const wu = wuState ? (WU_LABELS[wuState.mode] ?? WU_LABELS.unknown) : null
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 @3xl:grid-cols-3">
      <NextStep
        icon={DeveloperBoardSearchRegular}
        title="Drivers and BIOS"
        detail="Find missing drivers and BIOS updates for this device."
        action={<Button onClick={() => onNavigate('drivers')}>Open</Button>}
      />
      {activated === false ? (
        <NextStep
          icon={KeyRegular}
          title="Windows isn't activated"
          detail="Enter a product key from Technician tools."
          action={<Button onClick={() => onNavigate('tools')}>Activate</Button>}
        />
      ) : (
        <NextStep
          icon={KeyRegular}
          title={activated === true ? 'Windows is activated' : activationLabel(activated)}
          detail={join([info.os.name, info.os.version]) || 'Windows'}
        />
      )}
      <NextStep
        icon={ShieldCheckmarkRegular}
        title={wu ? wu.title : 'Windows Update'}
        detail={wu ? wu.detail : 'Reading its current mode…'}
        action={<Button onClick={() => onNavigate('tools')}>Change</Button>}
      />
    </div>
  )
}

/* -------------------------------------------------------------------- page -- */

export function OverviewModule({ onNavigate }) {
  const { staticInfo: info, dynamicInfo: live, error, isLoading, refresh } = useSystemInfoContext()
  return (
    <div className="page-enter @container mx-auto w-full max-w-[1200px] px-5 pt-2 pb-10 sm:px-8">
      {error && (
        <InfoBar severity="error" title="Couldn't read system information." className="mb-4">
          {error}
        </InfoBar>
      )}
      {isLoading && !info && (
        <Card className="flex items-center gap-3 px-4 py-5 text-text-secondary">
          <ProgressRing size={16} label="Reading components" />
          Reading components…
        </Card>
      )}
      {info && (
        <>
          <DeviceStage info={info} live={live} isLoading={isLoading} onRefresh={refresh} />
          <div className="mt-3 grid grid-cols-1 gap-3 @4xl:grid-cols-[1.15fr_1fr]">
            <TestsCard live={live} onNavigate={onNavigate} />
            <SpecsCard info={info} />
          </div>
          <NextSteps info={info} onNavigate={onNavigate} />
        </>
      )}
    </div>
  )
}
