import { useEffect, useState } from 'react'
import {
  AppsRegular,
  ArrowSyncCircleRegular,
  Battery6Regular,
  BroomRegular,
  DesktopPulseRegular,
  DesktopToolboxRegular,
  DocumentBulletListRegular,
  FlashRegular,
  GaugeRegular,
  GlobeDesktopRegular,
  HardDriveRegular,
  HistoryRegular,
  InfoRegular,
  KeyRegular,
  OpenRegular,
  PulseRegular,
  RamRegular,
  TabletRegular,
  WindowSettingsRegular,
  WindowWrenchRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Section, SettingsCard } from '@/components/ui/Card'
import { Badge, ContentDialog, InfoBar, ProgressRing } from '@/components/ui/feedback'
import { Select } from '@/components/ui/inputs'
import { useSystemInfoContext } from '@/context/SystemInfoContext'

const UTILITY_TOOLS = [
  { id: 'sysprep', label: 'Sysprep', icon: WindowWrenchRegular },
  { id: 'deviceManager', label: 'Device Manager', icon: DesktopToolboxRegular },
  { id: 'systemInformation', label: 'System Information', icon: InfoRegular },
  { id: 'dxdiag', label: 'DirectX Diagnostic', icon: DesktopPulseRegular },
  { id: 'eventViewer', label: 'Event Viewer', icon: DocumentBulletListRegular },
  { id: 'resourceMonitor', label: 'Resource Monitor', icon: PulseRegular },
  { id: 'diskManagement', label: 'Disk Management', icon: HardDriveRegular },
  { id: 'optimizeDrives', label: 'Optimize Drives', icon: GaugeRegular },
  { id: 'diskCleanup', label: 'Disk Cleanup', icon: BroomRegular },
  { id: 'systemConfiguration', label: 'System Configuration', icon: WindowSettingsRegular },
  { id: 'systemRestore', label: 'System Restore', icon: HistoryRegular },
  { id: 'programsAndFeatures', label: 'Programs and Features', icon: AppsRegular },
  { id: 'networkConnections', label: 'Network Connections', icon: GlobeDesktopRegular },
  { id: 'tabletCalibration', label: 'Tablet PC calibration', icon: TabletRegular }
]

// Shows the outcome of an action right under the section that triggered it
function ResultBar({ result, source, onDismiss }) {
  if (!result || result.source !== source) return null
  return (
    <InfoBar severity={result.success ? 'success' : 'error'} onDismiss={onDismiss} className="mt-1">
      {result.message}
    </InfoBar>
  )
}

function BusyLabel({ busy, busyText, children }) {
  if (!busy) return children
  return (
    <span className="flex items-center gap-2">
      <ProgressRing size={16} label={busyText} />
      {busyText}
    </span>
  )
}

const WU_POLL_MS = 5e3

const WU_MODES = [
  {
    id: 'default',
    label: 'Windows default',
    description: 'Windows installs every update and driver it finds, as it does out of the box.'
  },
  {
    id: 'security',
    label: 'Security updates only',
    description:
      'Security updates install 4 days late, feature updates wait a year, and Windows Update no longer replaces drivers.'
  },
  {
    id: 'disabled',
    label: 'Off',
    description: 'Windows won’t download updates or drivers, even after a restart.'
  }
]

function describeWuService({ running, startType, managed }) {
  return [
    `Service ${running ? 'running' : 'stopped'}`,
    `startup ${startType ?? 'unknown'}`,
    managed ? 'managed by an update server (WSUS)' : null
  ]
    .filter(Boolean)
    .join(' · ')
}

export function ToolsModule() {
  const { staticInfo: info } = useSystemInfoContext()
  const [result, setResult] = useState(null)
  const [wuState, setWuState] = useState(null)
  const [wuBusy, setWuBusy] = useState(false)
  const [wuConfirmOff, setWuConfirmOff] = useState(false)
  const [reportBusy, setReportBusy] = useState(null)
  const [checkDiskDialogOpen, setCheckDiskDialogOpen] = useState(false)
  const [checkDiskBusy, setCheckDiskBusy] = useState(false)
  // Windows can start or re-enable the service on its own, so keep checking
  // while the page is open (paused while the switch is applying a change)
  useEffect(() => {
    if (wuBusy) return
    let cancelled = false
    let timeoutId = null
    async function poll() {
      try {
        const state = await window.api.getWindowsUpdateState()
        if (!cancelled) setWuState(state)
      } finally {
        if (!cancelled) timeoutId = setTimeout(() => void poll(), WU_POLL_MS)
      }
    }
    void poll()
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [wuBusy])
  const run = async (source, action, { showSuccess = true } = {}) => {
    setResult(null)
    const outcome = await action()
    // Opening a tool shows its window, which is confirmation enough
    if (!outcome.success || showSuccess) setResult({ source, ...outcome })
    return outcome
  }
  const setWindowsUpdateMode = async (mode) => {
    setWuBusy(true)
    await run('windows', () => window.api.setWindowsUpdateMode(mode))
    setWuState(await window.api.getWindowsUpdateState())
    setWuBusy(false)
    setWuConfirmOff(false)
  }
  const chooseWindowsUpdateMode = (mode) => {
    if (mode === wuState?.mode) return
    // Turning updates off entirely is the one choice that needs a second look
    if (mode === 'disabled') setWuConfirmOff(true)
    else void setWindowsUpdateMode(mode)
  }
  const wuMode = WU_MODES.find((m) => m.id === wuState?.mode)
  const generateReport = async (kind) => {
    setReportBusy(kind)
    await run('reports', () =>
      kind === 'battery' ? window.api.generateBatteryReport() : window.api.generateEnergyReport()
    )
    setReportBusy(null)
  }
  const scheduleCheckDisk = async () => {
    setCheckDiskBusy(true)
    await run('maintenance', () => window.api.scheduleCheckDiskOnRestart())
    setCheckDiskBusy(false)
    setCheckDiskDialogOpen(false)
  }
  const launch = (source, toolId) =>
    void run(source, () => window.api.launchSystemTool(toolId), { showSuccess: false })
  const activated = info?.os.activated
  return (
    <Page
      title="Technician tools"
      description="Windows settings, reports and utilities used while preparing or repairing a device."
    >
      <Section title="Windows">
        <SettingsCard
          icon={ArrowSyncCircleRegular}
          title="Windows Update"
          description={
            <>
              {wuMode ? wuMode.description : 'Choose how Windows downloads updates and drivers. Needs administrator.'}
              {wuState && wuState.mode !== 'unknown' && (
                <span className="block">{describeWuService(wuState)}</span>
              )}
            </>
          }
        >
          {wuBusy && <ProgressRing size={16} label="Applying" />}
          <Select
            id="windows-update-mode"
            aria-label="Windows Update"
            className="w-56"
            value={wuState?.mode ?? 'default'}
            disabled={wuBusy || wuState === null || wuState.mode === 'unknown'}
            onChange={chooseWindowsUpdateMode}
          >
            {WU_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </SettingsCard>
        <SettingsCard
          icon={KeyRegular}
          title="Activation"
          description={
            activated === false
              ? 'This copy of Windows isn’t activated.'
              : 'Enter or change the Windows product key.'
          }
        >
          {activated === true && <Badge tone="success">Activated</Badge>}
          {activated === false && <Badge tone="critical">Not activated</Badge>}
          {info && activated === undefined && (
            <ProgressRing size={16} label="Checking activation" />
          )}
          <Button
            variant={activated === false ? 'accent' : 'standard'}
            onClick={() =>
              void run('windows', () => window.api.launchProductKeyDialog(), { showSuccess: false })
            }
          >
            {activated === false ? 'Enter product key' : 'Change product key'}
          </Button>
        </SettingsCard>
        <ResultBar result={result} source="windows" onDismiss={() => setResult(null)} />
      </Section>

      <Section title="Reports">
        <SettingsCard
          icon={Battery6Regular}
          title="Battery health report"
          description="Design vs. full-charge capacity and usage history (powercfg /batteryreport)."
        >
          <Button disabled={reportBusy !== null} onClick={() => void generateReport('battery')}>
            <BusyLabel busy={reportBusy === 'battery'} busyText="Generating…">
              Generate
            </BusyLabel>
          </Button>
        </SettingsCard>
        <SettingsCard
          icon={FlashRegular}
          title="Energy efficiency report"
          description="Traces the system for 60 seconds and lists power problems (powercfg /energy)."
        >
          <Button disabled={reportBusy !== null} onClick={() => void generateReport('energy')}>
            <BusyLabel busy={reportBusy === 'energy'} busyText="Tracing (up to 60 s)…">
              Run
            </BusyLabel>
          </Button>
        </SettingsCard>
        <ResultBar result={result} source="reports" onDismiss={() => setResult(null)} />
      </Section>

      <Section title="Maintenance">
        <SettingsCard
          icon={RamRegular}
          title="Memory diagnostic"
          description="Tests the RAM for errors. Windows asks whether to restart now or at the next boot."
        >
          <Button icon={OpenRegular} onClick={() => launch('maintenance', 'memoryDiagnostic')}>
            Open
          </Button>
        </SettingsCard>
        <SettingsCard
          icon={HardDriveRegular}
          title="Disk check"
          description="Scans the system drive for file system errors on the next restart."
        >
          <Button onClick={() => setCheckDiskDialogOpen(true)}>Schedule</Button>
        </SettingsCard>
        <ResultBar result={result} source="maintenance" onDismiss={() => setResult(null)} />
      </Section>

      <Section title="Windows utilities">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {UTILITY_TOOLS.map((tool) => (
            <SettingsCard
              key={tool.id}
              icon={tool.icon}
              title={tool.label}
              trailingIcon={OpenRegular}
              className="min-h-12 py-2"
              onClick={() => launch('utilities', tool.id)}
            />
          ))}
        </div>
        <ResultBar result={result} source="utilities" onDismiss={() => setResult(null)} />
      </Section>

      <ContentDialog
        open={wuConfirmOff}
        title="Turn off Windows Update?"
        primaryText={wuBusy ? 'Turning off…' : 'Turn off'}
        onPrimary={() => void setWindowsUpdateMode('disabled')}
        onClose={() => setWuConfirmOff(false)}
        busy={wuBusy}
      >
        Windows will stop downloading every update, security updates included, until you choose
        another option here. Use it while preparing a computer, and choose Windows default or
        Security updates only before handing it over.
      </ContentDialog>
      <ContentDialog
        open={checkDiskDialogOpen}
        title="Schedule a disk check?"
        primaryText={checkDiskBusy ? 'Scheduling…' : 'Schedule'}
        onPrimary={() => void scheduleCheckDisk()}
        onClose={() => setCheckDiskDialogOpen(false)}
        busy={checkDiskBusy}
      >
        Windows will check the system drive the next time the computer restarts, before anyone signs
        in. It can take a while on large drives. Nothing happens until you restart.
      </ContentDialog>
    </Page>
  )
}
