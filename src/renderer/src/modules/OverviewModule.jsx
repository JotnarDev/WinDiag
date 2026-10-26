import { useEffect, useState } from 'react'
import {
  Activity,
  AppWindow,
  BatteryFull,
  ChevronDown,
  CirclePause,
  CirclePlay,
  Cog,
  Component,
  Cpu,
  Disc3,
  FileChartColumnIncreasing,
  Gauge,
  HardDrive,
  IdCard,
  Info,
  KeyRound,
  MemoryStick,
  Monitor,
  MonitorPlay,
  Network,
  RefreshCw,
  RotateCcwClock,
  ScrollText,
  Settings2,
  Tablet,
  Trash,
  TriangleAlert,
  Wrench,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSystemInfoContext } from '@/context/SystemInfoContext'
import { cn } from '@/lib/utils'

const UTILITY_TOOLS = [
  {
    id: 'sysprep',
    label: 'Sysprep',
    icon: Cog
  },
  {
    id: 'tabletCalibration',
    label: 'Tablet PC calibration',
    icon: Tablet
  },
  {
    id: 'dxdiag',
    label: 'DirectX Diagnostic',
    icon: MonitorPlay
  },
  {
    id: 'systemInformation',
    label: 'System Information',
    icon: Info
  },
  {
    id: 'deviceManager',
    label: 'Device Manager',
    icon: Component
  },
  {
    id: 'eventViewer',
    label: 'Event Viewer',
    icon: ScrollText
  },
  {
    id: 'resourceMonitor',
    label: 'Resource Monitor',
    icon: Activity
  },
  {
    id: 'diskManagement',
    label: 'Disk Management',
    icon: Disc3
  },
  {
    id: 'optimizeDrives',
    label: 'Optimize Drives',
    icon: Gauge
  },
  {
    id: 'diskCleanup',
    label: 'Disk Cleanup',
    icon: Trash
  },
  {
    id: 'systemConfiguration',
    label: 'System Configuration',
    icon: Settings2
  },
  {
    id: 'systemRestore',
    label: 'System Restore',
    icon: RotateCcwClock
  },
  {
    id: 'programsAndFeatures',
    label: 'Programs and Features',
    icon: AppWindow
  },
  {
    id: 'networkConnections',
    label: 'Network Connections',
    icon: Network
  }
]

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-200">{value}</span>
    </div>
  )
}

function formatKB(kb) {
  if (kb === null) return '—'
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

function SummaryTile({ icon: Icon2, title, summary, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        'flex flex-col items-start gap-2 rounded-xl border bg-card px-4 py-4 text-left shadow-sm transition-colors',
        active ? 'border-primary ring-1 ring-primary' : 'border-zinc-800 hover:bg-zinc-800/60'
      )}
    >
      <div className="flex w-full items-center justify-between">
        <Icon2 className="h-5 w-5 text-zinc-400" />
        <ChevronDown
          className={cn(
            'h-4 w-4 text-zinc-400 transition-transform duration-200',
            active && 'rotate-180'
          )}
        />
      </div>
      <div className="font-semibold leading-none">{title}</div>
      <div className="w-full truncate text-xs text-zinc-500">{summary}</div>
    </button>
  )
}

export function OverviewModule() {
  const { staticInfo: info, error, isLoading, refresh } = useSystemInfoContext()
  const [activeSection, setActiveSection] = useState(null)
  const [toolMessage, setToolMessage] = useState(null)
  const [wuState, setWuState] = useState(null)
  const [wuBusy, setWuBusy] = useState(false)
  const [reportBusy, setReportBusy] = useState(null)
  const [confirmingCheckDisk, setConfirmingCheckDisk] = useState(false)
  const [checkDiskBusy, setCheckDiskBusy] = useState(false)
  const toggle = (key) => {
    setActiveSection((current) => (current === key ? null : key))
  }
  useEffect(() => {
    if (info?.os.activated !== false) return
    let cancelled = false
    void window.api.getWindowsUpdateServiceState().then((state) => {
      if (!cancelled) setWuState(state)
    })
    return () => {
      cancelled = true
    }
  }, [info?.os.activated])
  const runToolAction = async (action) => {
    setToolMessage(null)
    const result = await action()
    setToolMessage({
      text: result.message,
      isError: !result.success
    })
  }
  const handleStopWindowsUpdate = async () => {
    setWuBusy(true)
    setToolMessage(null)
    const result = await window.api.stopWindowsUpdateService()
    setToolMessage({
      text: result.message,
      isError: !result.success
    })
    setWuState(await window.api.getWindowsUpdateServiceState())
    setWuBusy(false)
  }
  const handleStartWindowsUpdate = async () => {
    setWuBusy(true)
    setToolMessage(null)
    const result = await window.api.startWindowsUpdateService()
    setToolMessage({
      text: result.message,
      isError: !result.success
    })
    setWuState(await window.api.getWindowsUpdateServiceState())
    setWuBusy(false)
  }
  const handleGenerateBatteryReport = async () => {
    setReportBusy('battery')
    setToolMessage(null)
    const result = await window.api.generateBatteryReport()
    setToolMessage({
      text: result.message,
      isError: !result.success
    })
    setReportBusy(null)
  }
  const handleGenerateEnergyReport = async () => {
    setReportBusy('energy')
    setToolMessage(null)
    const result = await window.api.generateEnergyReport()
    setToolMessage({
      text: result.message,
      isError: !result.success
    })
    setReportBusy(null)
  }
  const handleScheduleCheckDisk = async () => {
    setCheckDiskBusy(true)
    setToolMessage(null)
    const result = await window.api.scheduleCheckDiskOnRestart()
    setToolMessage({
      text: result.message,
      isError: !result.success
    })
    setCheckDiskBusy(false)
    setConfirmingCheckDisk(false)
  }
  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Device overview</h1>
          <p className="text-sm text-zinc-500">
            Spec sheet of the installed components. Click a card to see the full detail.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </header>
      {error && (
        <Card className="mb-4 border-red-900/50 bg-red-950/40">
          <CardContent className="py-4 text-sm text-red-400">
            {'Could not read system information: '}
            {error}
          </CardContent>
        </Card>
      )}
      {isLoading && !info && (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">Reading components…</CardContent>
        </Card>
      )}
      {info && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-zinc-200">
              <IdCard className="h-4 w-4 text-zinc-400" />
              {[info.device.manufacturer, info.device.model].filter(Boolean).join(' ') ||
                'Manufacturer and model not reported'}
            </div>
            <div className="text-zinc-500">
              Serial number:{' '}
              <span className="font-medium text-zinc-300">
                {info.device.serialNumber ?? 'Not available'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile
              icon={Cpu}
              title="Processor"
              summary={`${info.cpu.brand} · ${info.cpu.physicalCores} cores · ${info.cpu.baseSpeedGHz} GHz`}
              active={activeSection === 'cpu'}
              onClick={() => toggle('cpu')}
            />
            <SummaryTile
              icon={MemoryStick}
              title="RAM"
              summary={`${info.memory.totalGB} GB · ${info.memory.moduleCount} ${info.memory.moduleCount === 1 ? 'module' : 'modules'}`}
              active={activeSection === 'ram'}
              onClick={() => toggle('ram')}
            />
            <SummaryTile
              icon={HardDrive}
              title="Storage"
              summary={`${info.storage.totalGB} GB · ${info.storage.disks.length} ${info.storage.disks.length === 1 ? 'disk' : 'disks'}`}
              active={activeSection === 'storage'}
              onClick={() => toggle('storage')}
            />
            <SummaryTile
              icon={BatteryFull}
              title="Battery"
              summary={
                info.battery
                  ? `${info.battery.manufacturer ?? 'Manufacturer not reported'}${info.battery.chemistry ? ` · ${info.battery.chemistry}` : ''}`
                  : 'No battery (desktop)'
              }
              active={activeSection === 'battery'}
              onClick={() => toggle('battery')}
            />
            <SummaryTile
              icon={Cog}
              title="BIOS"
              summary={`${info.bios.vendor ?? 'Manufacturer not reported'}${info.bios.version ? ` · v${info.bios.version}` : ''}`}
              active={activeSection === 'bios'}
              onClick={() => toggle('bios')}
            />
            <SummaryTile
              icon={Monitor}
              title="Operating system"
              summary={`${info.os.name ?? 'Windows'} · ${info.os.activated === true ? 'Activated' : info.os.activated === false ? 'Not activated' : 'Activation unknown'}`}
              active={activeSection === 'os'}
              onClick={() => toggle('os')}
            />
          </div>
          <div
            className={cn(
              'grid transition-all duration-200 ease-in-out',
              activeSection ? 'mt-3 grid-rows-[1fr]' : 'grid-rows-[0fr]'
            )}
          >
            <div className="overflow-hidden">
              <Card>
                <CardContent className="py-5">
                  {activeSection === 'cpu' && (
                    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoRow label="Manufacturer" value={info.cpu.manufacturer} />
                      <InfoRow label="Socket" value={info.cpu.socket ?? '—'} />
                      <InfoRow label="Physical cores" value={String(info.cpu.physicalCores)} />
                      <InfoRow label="Logical cores" value={String(info.cpu.cores)} />
                      <InfoRow label="Base speed" value={`${info.cpu.baseSpeedGHz} GHz`} />
                      <InfoRow
                        label="Max speed"
                        value={info.cpu.maxSpeedGHz !== null ? `${info.cpu.maxSpeedGHz} GHz` : '—'}
                      />
                      <InfoRow
                        label="Family / Model"
                        value={[info.cpu.family, info.cpu.model].filter(Boolean).join(' / ') || '—'}
                      />
                      <InfoRow
                        label="L1 cache"
                        value={formatKB(info.cpu.cache.l1dKB ?? info.cpu.cache.l1iKB)}
                      />
                      <InfoRow label="L2 cache" value={formatKB(info.cpu.cache.l2KB)} />
                      <InfoRow label="L3 cache" value={formatKB(info.cpu.cache.l3KB)} />
                    </div>
                  )}
                  {activeSection === 'ram' &&
                    (info.memory.modules.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        The system did not report details for the installed modules.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {info.memory.modules.map((m, i) => (
                          <div key={i} className="rounded-md border border-zinc-800 p-3">
                            <div className="mb-1 text-sm font-semibold text-zinc-200">
                              {m.bank ?? `Module ${i + 1}`}
                              {' · '}
                              {m.capacityGB}
                              {' GB'}
                            </div>
                            <InfoRow label="Type" value={m.type ?? '—'} />
                            <InfoRow label="Speed" value={m.speedMHz ? `${m.speedMHz} MHz` : '—'} />
                            <InfoRow label="Manufacturer" value={m.manufacturer ?? '—'} />
                            <InfoRow label="Part number" value={m.partNumber ?? '—'} />
                            <InfoRow label="Serial number" value={m.serialNumber ?? '—'} />
                          </div>
                        ))}
                      </div>
                    ))}
                  {activeSection === 'storage' &&
                    (info.storage.disks.length === 0 ? (
                      <p className="text-sm text-zinc-500">No physical disks detected.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {info.storage.disks.map((d, i) => (
                          <div key={i} className="rounded-md border border-zinc-800 p-3">
                            <div className="mb-1 text-sm font-semibold text-zinc-200">
                              {d.name}
                              {' · '}
                              {d.capacityGB}
                              {' GB'}
                            </div>
                            <InfoRow label="Type" value={d.type ?? '—'} />
                            <InfoRow label="Interface" value={d.interfaceType ?? '—'} />
                            <InfoRow label="Manufacturer" value={d.vendor ?? '—'} />
                            <InfoRow label="Serial number" value={d.serialNumber ?? '—'} />
                            <InfoRow label="S.M.A.R.T. status" value={d.smartStatus ?? '—'} />
                          </div>
                        ))}
                      </div>
                    ))}
                  {activeSection === 'battery' &&
                    (info.battery ? (
                      <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                        <InfoRow label="Manufacturer" value={info.battery.manufacturer ?? '—'} />
                        <InfoRow label="Model" value={info.battery.model ?? '—'} />
                        <InfoRow label="Serial number" value={info.battery.serialNumber ?? '—'} />
                        <InfoRow label="Chemistry" value={info.battery.chemistry ?? '—'} />
                        <InfoRow
                          label="Design capacity"
                          value={
                            info.battery.designedCapacityMWh
                              ? `${info.battery.designedCapacityMWh} mWh`
                              : '—'
                          }
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">{`This device does not report a battery (it's probably a desktop). To see the live charge level when one is present, check the "Battery" module.`}</p>
                    ))}
                  {activeSection === 'bios' && (
                    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoRow label="Manufacturer" value={info.bios.vendor ?? '—'} />
                      <InfoRow label="Version" value={info.bios.version ?? '—'} />
                      <InfoRow label="Release date" value={info.bios.releaseDate ?? '—'} />
                    </div>
                  )}
                  {activeSection === 'os' && (
                    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoRow label="System" value={info.os.name ?? '—'} />
                      <InfoRow label="Version" value={info.os.version ?? '—'} />
                      <InfoRow label="Build" value={info.os.build ?? '—'} />
                      <InfoRow label="Architecture" value={info.os.architecture ?? '—'} />
                      <div className="flex items-center justify-between gap-3 py-1 text-sm">
                        <span className="text-zinc-500">Activation</span>
                        <span
                          className={cn(
                            'font-medium',
                            info.os.activated === true
                              ? 'text-emerald-400'
                              : info.os.activated === false
                                ? 'text-red-400'
                                : 'text-zinc-500'
                          )}
                        >
                          {info.os.activated === true
                            ? 'Activated'
                            : info.os.activated === false
                              ? 'Not activated'
                              : 'Could not be determined'}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center gap-2">
              <Wrench className="h-5 w-5 text-zinc-400" />
              <div>
                <CardTitle>Technician tools</CardTitle>
                <CardDescription>
                  Shortcuts to common Windows setup and diagnostic utilities
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Utilities
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {UTILITY_TOOLS.map(({ id, label, icon: Icon2 }) => (
                    <Button
                      key={id}
                      variant="outline"
                      size="sm"
                      className="justify-start gap-2"
                      onClick={() => void runToolAction(() => window.api.launchSystemTool(id))}
                    >
                      <Icon2 className="h-4 w-4" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Reports
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={reportBusy !== null}
                    onClick={() => void handleGenerateBatteryReport()}
                  >
                    <FileChartColumnIncreasing className="h-4 w-4" />
                    {reportBusy === 'battery' ? 'Generating…' : 'Battery health report'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={reportBusy !== null}
                    onClick={() => void handleGenerateEnergyReport()}
                  >
                    <Zap className="h-4 w-4" />
                    {reportBusy === 'energy' ? 'Running (up to 60s)…' : 'Energy efficiency report'}
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Advanced
                </p>
                <div className="flex flex-wrap items-start gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      void runToolAction(() => window.api.launchSystemTool('memoryDiagnostic'))
                    }
                  >
                    <MemoryStick className="h-4 w-4" />
                    Memory diagnostic (restart required)
                  </Button>
                  {!confirmingCheckDisk ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setConfirmingCheckDisk(true)}
                    >
                      <TriangleAlert className="h-4 w-4" />
                      Schedule disk check (next restart)
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-md border border-amber-900/50 bg-amber-950/40 p-3">
                      <p className="text-xs text-amber-400">
                        This schedules a full disk check on the system drive for the next restart —
                        Windows runs it automatically before signing in, and it can take a while on
                        large drives. Nothing happens until the computer is actually restarted.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={checkDiskBusy}
                          onClick={() => void handleScheduleCheckDisk()}
                        >
                          {checkDiskBusy ? 'Scheduling…' : 'Yes, schedule it'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={checkDiskBusy}
                          onClick={() => setConfirmingCheckDisk(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {info.os.activated === false && (
                <div className="rounded-md border border-amber-900/50 bg-amber-950/40 p-3">
                  <p className="mb-3 text-sm font-medium text-amber-400">
                    This copy of Windows is not activated.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      className="gap-2"
                      onClick={() => void runToolAction(() => window.api.launchProductKeyDialog())}
                    >
                      <KeyRound className="h-4 w-4" />
                      Enter product key
                    </Button>
                    {wuState === 'stopped' ? (
                      <Button
                        variant="outline"
                        className="gap-2"
                        disabled={wuBusy}
                        onClick={() => void handleStartWindowsUpdate()}
                      >
                        <CirclePlay className="h-4 w-4" />
                        {wuBusy ? 'Resuming…' : 'Resume Windows Update service'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="gap-2"
                        disabled={wuBusy}
                        onClick={() => void handleStopWindowsUpdate()}
                      >
                        <CirclePause className="h-4 w-4" />
                        {wuBusy ? 'Stopping…' : 'Stop Windows Update service'}
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-amber-400">
                    {
                      'Stopping the service is temporary — use "Resume" (or restart Windows) to turn it back on. These actions may prompt for administrator permission.'
                    }
                  </p>
                </div>
              )}
              {toolMessage && (
                <p
                  className={cn(
                    'text-sm',
                    toolMessage.isError ? 'text-red-400' : 'text-emerald-400'
                  )}
                >
                  {toolMessage.text}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
