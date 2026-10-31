import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRightRegular,
  BuildingFactoryRegular,
  CheckmarkCircle16Filled,
  CheckmarkCircleRegular,
  CopyRegular,
  DeveloperBoardSearchRegular,
  CloudArrowDownRegular,
  FolderOpenRegular,
  OpenRegular,
  QuestionCircleRegular,
  ShieldKeyholeRegular,
  WarningRegular
} from '@fluentui/react-icons'
import { useI18n } from '../i18n'
import { SITE } from '../lib/site'
import { EASE, Reveal, RevealItem } from '../lib/motion'
import { ProgressBar, ToggleSwitch, UiButton } from '../fragments/ui'
import { Button } from './Button'

const CATALOG_PATH = '\\\\server\\share\\02 Drivers\\drivers-catalog.json'

// A real catalog entry: the latest FZ-55 MK2 BIOS on Panasonic's site (Oct 2026)
const BIOS_ENTRY = `{
  "manufacturer": "Panasonic",
  "model": "FZ-55",
  "version": "V2.00L31",
  "installedPrefix": "V2.",
  "path": "Panasonic\\\\FZ-55\\\\FZ-55 MK2\\\\BIOS_55_V200L31.exe"
}`

// What each source offers this FZ-55. Where two offer a driver for the same
// device, the newest wins, as in WinDiag.
const DEVICES = [
  {
    name: 'Intel Wi-Fi 6E AX211 160MHz',
    installed: '23.80.0.3',
    offers: { folder: '24.50.0.4' }
  },
  {
    name: 'Intel Wireless Bluetooth',
    installed: '23.80.0.3',
    offers: { windowsUpdate: '24.40.10.3' }
  },
  {
    name: 'Intel Iris Xe Graphics',
    installed: '31.0.101.5186',
    offers: { folder: '32.0.101.7026', windowsUpdate: '32.0.101.6881' }
  },
  { name: 'Sierra Wireless EM7511', installed: null, hardwareId: 'USB\\VID_1199&PID_90D3', offers: { folder: '9.0260.5289.0006' } },
  { name: 'Unknown device', installed: null, hardwareId: 'ACPI\\MAT0033', offers: {} }
]

const SOURCE_ICONS = {
  folder: FolderOpenRegular,
  windowsUpdate: CloudArrowDownRegular,
  makers: BuildingFactoryRegular
}

const versionParts = (v) => v.split('.').map(Number)
const isNewer = (a, b) => {
  const [pa, pb] = [versionParts(a), versionParts(b)]
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  }
  return false
}

/** Sorts the devices into the page's groups for the sources that are on. */
function compareWith(sources) {
  const updates = []
  const missing = []
  const notFound = []
  for (const device of DEVICES) {
    const best = Object.entries(device.offers)
      .filter(([source]) => sources[source])
      .reduce((top, [source, version]) => (!top || isNewer(version, top.version) ? { source, version } : top), null)
    if (!device.installed) (best ? missing : notFound).push({ ...device, best })
    else if (best && isNewer(best.version, device.installed)) updates.push({ ...device, best })
  }
  return { updates, missing, notFound }
}

function Panel({ children, className = '' }) {
  return <div className={`rounded-[8px] border border-card-stroke bg-card p-4 sm:p-5 ${className}`}>{children}</div>
}

function GroupHeader({ icon: Icon, label, count, tone }) {
  return (
    <div className="flex items-center gap-2 pb-2 pt-1 text-[14px] font-semibold">
      <Icon fontSize={18} className={tone} />
      {label}
      <span className="tabular rounded-full bg-subtle-hover px-2 text-[12px] font-normal">{count}</span>
    </div>
  )
}

function OfferLine({ device }) {
  const { t } = useI18n()
  return (
    <div className="tabular text-[12px] text-ui-text-2">
      {device.installed ? `${device.installed} → ` : ''}
      {device.best.version} · {t('flow.from')} {t(`flow.sourceNames.${device.best.source}`)}
    </div>
  )
}

function CompareResult({ sources }) {
  const { t } = useI18n()
  const { updates, missing, notFound } = compareWith(sources)
  return (
    <Panel className="flex flex-col gap-3">
      {updates.length > 0 && (
        <div>
          <GroupHeader icon={ArrowRightRegular} label={t('flow.updates')} count={updates.length} tone="text-accent" />
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {updates.map((device) => (
              <li
                key={device.name}
                className="flex items-center gap-3 rounded-[4px] bg-control px-3 py-2 hover:bg-control-hover"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{device.name}</div>
                  <OfferLine device={device} />
                </div>
                <UiButton>{t('flow.update')}</UiButton>
              </li>
            ))}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <div>
          <GroupHeader icon={WarningRegular} label={t('flow.missing')} count={missing.length} tone="text-caution" />
          {missing.map((device) => (
            <div key={device.name} className="flex items-center gap-3 rounded-[4px] bg-control px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate">{device.name}</div>
                <OfferLine device={device} />
              </div>
              <UiButton>{t('flow.install')}</UiButton>
            </div>
          ))}
        </div>
      )}
      {notFound.length > 0 && (
        <div>
          <GroupHeader icon={QuestionCircleRegular} label={t('flow.notFound')} count={notFound.length} tone="text-ui-text-2" />
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[4px] bg-control px-3 py-2">
              <span className="hidden shrink-0 sm:block">
                <BuildingFactoryRegular fontSize={20} className="block" />
              </span>
              <div className="min-w-[min(100%,13rem)] flex-1">
                <div className="truncate">{t('flow.support')}</div>
                <div className="truncate text-[12px] text-ui-text-2">{t('flow.supportDetail')}</div>
              </div>
              <UiButton>
                <span className="hidden sm:inline-flex">
                  <OpenRegular fontSize={16} />
                </span>
                {t('flow.openSupport')}
              </UiButton>
            </li>
            {notFound.map((device) => (
              <li key={device.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[4px] bg-control px-3 py-2">
                <div className="min-w-[min(100%,13rem)] flex-1">
                  <div className="truncate">{device.name}</div>
                  <div className="tabular truncate text-[12px] text-ui-text-2">{device.hardwareId}</div>
                </div>
                <UiButton>
                  <span className="hidden sm:inline-flex">
                  <OpenRegular fontSize={16} />
                </span>
                  {t('flow.searchCatalog')}
                </UiButton>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between">
        <GroupHeader icon={CheckmarkCircleRegular} label={t('flow.upToDate')} count={42} tone="text-success" />
        {updates.length + missing.length > 0 && <UiButton accent>{t('flow.updateAll')}</UiButton>}
      </div>
    </Panel>
  )
}

function SourceRow({ id, on, onChange, children }) {
  const { t } = useI18n()
  const Icon = SOURCE_ICONS[id]
  return (
    <div className="rounded-[4px] bg-card px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="hidden shrink-0 sm:block">
          <Icon fontSize={20} className="block" />
        </span>
        <div className="min-w-0 flex-1 py-1">
          <div className="text-[14px]">{t(`flow.sources.${id}.name`)}</div>
          <div className="text-[12px] text-ui-text-2">{t(`flow.sources.${id}.detail`)}</div>
        </div>
        <ToggleSwitch checked={on} onChange={onChange} label={t(`flow.sources.${id}.name`)} />
      </div>
      {on && children}
    </div>
  )
}

function CopyCode({ code }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked: the code is still selectable
    }
  }
  return (
    <div data-ui className="relative rounded-[8px] bg-stage">
      <pre className="m-0 overflow-x-auto p-5 pr-24 text-[14px] leading-[1.6]">
        <code className="font-mono">{code}</code>
      </pre>
      <UiButton onClick={copy} className="absolute right-3 top-3">
        {copied ? <CheckmarkCircle16Filled className="text-success" /> : <CopyRegular fontSize={16} />}
        {copied ? t('flow.copied') : t('flow.copy')}
      </UiButton>
    </div>
  )
}

/** Comparing drivers, step by step: what you give WinDiag and what it gives back. */
export function DriversFlow() {
  const { t } = useI18n()
  const steps = t('flow.steps')
  const [phase, setPhase] = useState('done') // 'idle' | 'running' | 'done'
  const [sources, setSources] = useState({ folder: true, windowsUpdate: true, makers: true })
  const anySource = sources.folder || sources.windowsUpdate || sources.makers
  const toggle = (id) => (on) => setSources((current) => ({ ...current, [id]: on }))
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  const compare = () => {
    setPhase('running')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPhase('done'), 1400)
  }

  return (
    <section id="drivers" className="scroll-mt-16 bg-stage py-[clamp(96px,13vw,200px)] transition-colors duration-500">
      <div className="frame">
        <Reveal className="mx-auto max-w-[760px]">
          <RevealItem as="h2" className="text-h2">
            {t('flow.title')}
          </RevealItem>
          <RevealItem as="p" className="mt-6 max-w-[48ch] text-[20px] leading-[1.45]">
            {t('flow.sentence')}
          </RevealItem>
        </Reveal>

        <ol className="mx-auto mt-16 flex max-w-[760px] list-none flex-col gap-[88px] p-0">
          {/* First: the catalog path */}
          <Reveal as="li" className="flex flex-col gap-4">
            <RevealItem as="p" className="text-[20px] font-semibold">
              {steps[0].lead}
            </RevealItem>
            <RevealItem>
              <div data-ui className="flex flex-col gap-2 rounded-[8px] bg-bg p-4 sm:p-5">
                <div className="mb-1 text-[14px] font-semibold">{t('flow.sourcesLabel')}</div>
                <SourceRow id="windowsUpdate" on={sources.windowsUpdate} onChange={toggle('windowsUpdate')} />
                <SourceRow id="makers" on={sources.makers} onChange={toggle('makers')} />
                <SourceRow id="folder" on={sources.folder} onChange={toggle('folder')}>
                  <div className="pb-2 pt-3">
                    <label className="mb-2 block text-[14px]" htmlFor="catalog-path">
                      {t('flow.catalogLabel')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="catalog-path"
                        readOnly
                        value={CATALOG_PATH}
                        className="tabular h-8 min-w-0 flex-1 rounded-[4px] border border-control-stroke border-b-accent bg-control px-3 text-[14px] text-ui-text"
                      />
                      <UiButton>
                        <FolderOpenRegular fontSize={16} />
                        {t('flow.browse')}
                      </UiButton>
                    </div>
                    <div className="mt-3 flex items-start gap-3 rounded-[4px] bg-success-bg px-3 py-2">
                      <CheckmarkCircle16Filled className="mt-0.5 shrink-0 text-success" />
                      <div className="text-[14px]">
                        <span className="font-semibold">{t('flow.catalogLoaded')}</span>
                        <span className="tabular ml-2 text-ui-text-2">{t('flow.catalogFacts')}</span>
                      </div>
                    </div>
                  </div>
                </SourceRow>
              </div>
            </RevealItem>
          </Reveal>

          {/* Then: compare */}
          <Reveal as="li" className="flex flex-col gap-4">
            <RevealItem as="p" className="text-[20px] font-semibold">
              {steps[1].lead}
            </RevealItem>
            <RevealItem>
              <div data-ui className="flex flex-col gap-3 rounded-[8px] bg-bg p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <UiButton accent onClick={compare} disabled={phase === 'running' || !anySource}>
                    <DeveloperBoardSearchRegular fontSize={16} />
                    {t('flow.compare')}
                  </UiButton>
                  {phase === 'running' && <span className="text-ui-text-2">{t('flow.comparing')}</span>}
                  {!anySource && <span className="text-ui-text-2">{t('flow.noSources')}</span>}
                </div>
                {phase === 'running' && <ProgressBar indeterminate />}
              </div>
            </RevealItem>
            <RevealItem className="sm:pl-14">
              <div data-ui>
                <AnimatePresence mode="wait">
                  {phase === 'done' && anySource && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.5, ease: EASE }}
                    >
                      <CompareResult sources={sources} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </RevealItem>
          </Reveal>

          {/* Last: the BIOS, with every safety check WinDiag runs */}
          <Reveal as="li" className="flex flex-col gap-4">
            <RevealItem as="p" className="text-[20px] font-semibold">
              {steps[2].lead}
            </RevealItem>
            <RevealItem>
              <p className="mb-2 text-[16px] text-muted">{t('flow.biosEntry')}</p>
              <CopyCode code={BIOS_ENTRY} />
            </RevealItem>
            <RevealItem className="sm:pl-14 xl:-mr-[180px]">
              <div data-ui className="rounded-[8px] bg-bg p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                  <div className="flex items-center gap-3">
                    <ShieldKeyholeRegular fontSize={28} className="text-accent" />
                    <div>
                      <div className="text-[16px] font-semibold">{t('flow.biosTitle')}</div>
                      <div className="text-ui-text-2">Panasonic FZ-55 MK2</div>
                    </div>
                  </div>
                  <div className="tabular flex gap-8">
                    <div>
                      <div className="text-[12px] text-ui-text-2">{t('flow.installed')}</div>
                      <div className="text-[18px] font-semibold">V2.00L26</div>
                    </div>
                    <div>
                      <div className="text-[12px] text-ui-text-2">{t('flow.inCatalog')}</div>
                      <div className="text-[18px] font-semibold text-accent">V2.00L31</div>
                    </div>
                  </div>
                  <UiButton accent className="ml-auto">
                    {t('flow.updateBios')}
                  </UiButton>
                </div>
                <ul className="m-0 mt-5 grid list-none gap-2 p-0 sm:grid-cols-3">
                  {t('flow.checks').map((check) => (
                    <li key={check} className="flex items-start gap-2 rounded-[4px] bg-card px-3 py-2.5">
                      <CheckmarkCircle16Filled className="mt-0.5 shrink-0 text-success" />
                      {check}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealItem>
          </Reveal>
        </ol>

        <div className="mx-auto mt-16 max-w-[760px]">
          <Button variant="quiet" href={SITE.driverGuide} className="text-[18px]">
            {t('flow.guide')}
          </Button>
        </div>
      </div>
    </section>
  )
}
