import { useState } from 'react'
import {
  ArrowSyncRegular,
  Battery6Regular,
  CheckmarkRegular,
  CopyRegular,
  DeveloperBoardLightningRegular,
  DeveloperBoardRegular,
  KeyRegular,
  LaptopRegular,
  RamRegular,
  SettingsRegular,
  StorageRegular,
  WindowRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card, Expander, PropertyList, Section } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressRing } from '@/components/ui/feedback'
import { useSystemInfoContext } from '@/context/SystemInfoContext'

const GPU_KIND_LABELS = {
  integrated: 'Integrated',
  dedicated: 'Dedicated',
  'no-driver': 'No driver installed',
  unknown: 'Type unknown'
}

const formatKB = (kb) =>
  kb === null || kb === undefined ? null : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
const formatVram = (mb) => (mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`)
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

function activationLabel(activated) {
  if (activated === true) return 'Activated'
  if (activated === false) return 'Not activated'
  if (activated === undefined) return 'Checking activation…'
  return 'Activation unknown'
}

function ActivationBadge({ activated }) {
  const tone = activated === true ? 'success' : activated === false ? 'critical' : 'neutral'
  return <Badge tone={tone}>{activationLabel(activated)}</Badge>
}

function gpuVram(gpu) {
  if (gpu.kind === 'integrated') return 'Shared with system RAM'
  return gpu.vramMB ? formatVram(gpu.vramMB) : null
}

function cacheSummary(cache) {
  const l1 = formatKB(cache.l1dKB ?? cache.l1iKB)
  const l2 = formatKB(cache.l2KB)
  const l3 = formatKB(cache.l3KB)
  return [l1 && `L1 ${l1}`, l2 && `L2 ${l2}`, l3 && `L3 ${l3}`].filter(Boolean).join(' · ') || null
}

// One block per RAM module / disk / GPU inside an expander
function SubItem({ title, items }) {
  return (
    <div className="border-t border-divider pt-3 first:border-t-0 first:pt-0">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <PropertyList items={items} />
    </div>
  )
}

// Plain-text version of the spec sheet for the clipboard (tickets, notes)
function specsAsText(info) {
  const join = (parts, separator = ' ') => parts.filter(Boolean).join(separator)
  return [
    `Device: ${join([info.device.manufacturer, info.device.model]) || '—'}${
      info.device.modelId ? ` (${info.device.modelId})` : ''
    }`,
    `Serial number: ${info.device.serialNumber ?? '—'}`,
    `Processor: ${info.cpu.brand} (${info.cpu.physicalCores} cores / ${info.cpu.cores} threads, ${info.cpu.baseSpeedGHz} GHz)`,
    `RAM: ${info.memory.totalGB} GB (${plural(info.memory.moduleCount, 'module', 'modules')})`,
    ...info.storage.disks.map(
      (d) =>
        `Disk: ${join([d.name, `${d.capacityGB} GB`, d.type, d.serialNumber && `S/N ${d.serialNumber}`], ' · ')}`
    ),
    ...info.gpus.map((g) => `Graphics: ${g.name} (${GPU_KIND_LABELS[g.kind]})`),
    `Battery: ${info.battery ? join([info.battery.manufacturer, info.battery.model]) || 'Present' : 'None'}`,
    `BIOS: ${join([info.bios.vendor, info.bios.version]) || '—'}`,
    `Windows: ${join([info.os.name, info.os.version, info.os.build && `build ${info.os.build}`, activationLabel(info.os.activated)], ' · ')}`
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
    <Button icon={copied ? CheckmarkRegular : CopyRegular} onClick={() => void handleCopy()}>
      {copied ? 'Copied' : 'Copy specs'}
    </Button>
  )
}

export function OverviewModule({ onNavigate }) {
  const { staticInfo: info, error, isLoading, refresh } = useSystemInfoContext()
  return (
    <Page
      title="Overview"
      description="Spec sheet of this device's installed components."
      actions={
        <>
          {info && <CopySpecsButton info={info} />}
          <Button icon={ArrowSyncRegular} onClick={refresh} disabled={isLoading}>
            Refresh
          </Button>
        </>
      }
    >
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
          <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-5">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-overlay bg-control-alt">
              <LaptopRegular aria-hidden className="size-8 text-accent-text" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="selectable font-display text-subtitle font-semibold">
                {[info.device.manufacturer, info.device.model].filter(Boolean).join(' ') ||
                  'Manufacturer and model not reported'}
              </p>
              {info.device.modelId && (
                <p className="text-text-secondary">
                  Model ID{' '}
                  <span className="selectable text-text-primary">{info.device.modelId}</span>
                </p>
              )}
              <p className="text-text-secondary">
                Serial number{' '}
                <span className="selectable text-text-primary">
                  {info.device.serialNumber ?? 'Not available'}
                </span>
              </p>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <span className="text-text-secondary">{info.os.name ?? 'Windows'}</span>
              <ActivationBadge activated={info.os.activated} />
            </div>
          </Card>
          {info.os.activated === false && (
            <InfoBar
              severity="warning"
              title="Windows isn't activated."
              className="mt-3"
              action={
                <Button icon={KeyRegular} onClick={() => onNavigate('tools')}>
                  Enter a product key
                </Button>
              }
            >
              You can activate it from Technician tools.
            </InfoBar>
          )}

          <Section title="Device specifications" className="mt-7">
            <Expander
              icon={DeveloperBoardRegular}
              title="Processor"
              description={`${info.cpu.brand} · ${plural(info.cpu.physicalCores, 'core', 'cores')} · ${info.cpu.baseSpeedGHz} GHz`}
            >
              <PropertyList
                items={[
                  ['Model', info.cpu.brand],
                  ['Manufacturer', info.cpu.manufacturer],
                  ['Cores / threads', `${info.cpu.physicalCores} / ${info.cpu.cores}`],
                  ['Base speed', `${info.cpu.baseSpeedGHz} GHz`],
                  [
                    'Max speed',
                    info.cpu.maxSpeedGHz !== null ? `${info.cpu.maxSpeedGHz} GHz` : null
                  ],
                  ['Socket', info.cpu.socket],
                  [
                    'Family / model',
                    [info.cpu.family, info.cpu.model].filter(Boolean).join(' / ') || null
                  ],
                  ['Cache', cacheSummary(info.cpu.cache)]
                ]}
              />
            </Expander>

            <Expander
              icon={RamRegular}
              title="Memory"
              description={`${info.memory.totalGB} GB · ${plural(info.memory.moduleCount, 'module', 'modules')}`}
            >
              {info.memory.modules.length === 0 ? (
                <p className="text-text-secondary">
                  The system didn&apos;t report details for the installed modules.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {info.memory.modules.map((m, i) => (
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
                  ))}
                </div>
              )}
            </Expander>

            <Expander
              icon={StorageRegular}
              title="Storage"
              description={`${info.storage.totalGB} GB · ${plural(info.storage.disks.length, 'disk', 'disks')}`}
              headerContent={
                <Button variant="subtle" onClick={() => onNavigate('disk')}>
                  Disk health
                </Button>
              }
            >
              {info.storage.disks.length === 0 ? (
                <p className="text-text-secondary">No physical disks detected.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {info.storage.disks.map((d, i) => (
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
                </div>
              )}
            </Expander>

            <Expander
              icon={DeveloperBoardLightningRegular}
              title="Graphics"
              description={
                info.gpus.length > 0
                  ? info.gpus.map((g) => `${g.name} (${GPU_KIND_LABELS[g.kind]})`).join(' · ')
                  : 'No graphics adapter reported'
              }
            >
              {info.gpus.length === 0 ? (
                <p className="text-text-secondary">
                  The system didn&apos;t report any graphics adapter.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {info.gpus.map((g, i) => (
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
                </div>
              )}
            </Expander>

            <Expander
              icon={Battery6Regular}
              title="Battery"
              description={
                info.battery
                  ? [
                      info.battery.manufacturer ?? 'Manufacturer not reported',
                      info.battery.chemistry
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'No battery (desktop)'
              }
              headerContent={
                info.battery && (
                  <Button variant="subtle" onClick={() => onNavigate('battery')}>
                    Battery test
                  </Button>
                )
              }
            >
              {info.battery ? (
                <PropertyList
                  items={[
                    ['Manufacturer', info.battery.manufacturer],
                    ['Model', info.battery.model],
                    ['Serial number', info.battery.serialNumber],
                    ['Chemistry', info.battery.chemistry],
                    [
                      'Design capacity',
                      info.battery.designedCapacityMWh
                        ? `${info.battery.designedCapacityMWh} mWh`
                        : null
                    ]
                  ]}
                />
              ) : (
                <p className="text-text-secondary">
                  This device doesn&apos;t report a battery (it&apos;s probably a desktop).
                </p>
              )}
            </Expander>

            <Expander
              icon={SettingsRegular}
              title="BIOS"
              description={[
                info.bios.vendor ?? 'Manufacturer not reported',
                info.bios.version && `v${info.bios.version}`
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              <PropertyList
                items={[
                  ['Manufacturer', info.bios.vendor],
                  ['Version', info.bios.version],
                  ['Release date', info.bios.releaseDate]
                ]}
              />
            </Expander>

            <Expander
              icon={WindowRegular}
              title="Windows"
              description={[info.os.name ?? 'Windows', info.os.version].filter(Boolean).join(' · ')}
              headerContent={<ActivationBadge activated={info.os.activated} />}
            >
              <PropertyList
                items={[
                  ['Edition', info.os.name],
                  ['Version', info.os.version],
                  ['OS build', info.os.build],
                  ['Architecture', info.os.architecture],
                  ['Activation', activationLabel(info.os.activated)]
                ]}
              />
            </Expander>
          </Section>
        </>
      )}
    </Page>
  )
}
