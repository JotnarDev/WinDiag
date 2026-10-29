import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowSyncRegular,
  BluetoothRegular,
  CellularData1Regular,
  ContactCardRegular,
  LocationRippleRegular,
  QrCodeRegular,
  Wifi1Regular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressRing } from '@/components/ui/feedback'
import { TextBox } from '@/components/ui/inputs'

const RADIO_STATE = {
  on: { label: 'On', tone: 'success' },
  off: { label: 'Off', tone: 'neutral' },
  disabled: { label: 'Disabled', tone: 'caution' },
  unknown: { label: 'Unknown', tone: 'neutral' }
}

function RadioStateBadge({ state }) {
  const { label, tone } = RADIO_STATE[state] ?? RADIO_STATE.unknown
  return <Badge tone={tone}>{label}</Badge>
}

/** A settings-style card with an optional details area under the header. */
function DeviceCard({ icon: Icon, title, description, loading, children, details }) {
  return (
    <div className="rounded-overlay border border-card-stroke bg-card">
      <div className="flex min-h-[68px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Icon aria-hidden className="size-5 shrink-0" />
        <div className="min-w-0 flex-1 basis-48">
          <div>{title}</div>
          <div className="text-caption text-text-secondary">
            {loading ? 'Detecting…' : description}
          </div>
        </div>
        {loading ? (
          <ProgressRing size={16} label={`Detecting ${title}`} />
        ) : (
          children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
      {!loading && details && (
        <div className="border-t border-divider px-4 py-3 sm:pl-[52px]">{details}</div>
      )}
    </div>
  )
}

function BusyButton({ busy, busyText, onClick, children }) {
  return (
    <Button onClick={onClick} disabled={busy}>
      {busy ? (
        <span className="flex items-center gap-2">
          <ProgressRing size={16} label={busyText} />
          {busyText}
        </span>
      ) : (
        children
      )}
    </Button>
  )
}

const SCAN_MAX_AVG_INTERVAL_MS = 30
const SCAN_MIN_CHARS = 3
const SCAN_IDLE_RESET_MS = 600

export function OtherDevicesModule() {
  const [snapshot, setSnapshot] = useState(null)
  const [loadingSnapshot, setLoadingSnapshot] = useState(true)
  const loadSnapshot = useCallback(async () => {
    setLoadingSnapshot(true)
    try {
      const next = await window.api.getOtherDevicesSnapshot()
      setSnapshot(next)
    } finally {
      setLoadingSnapshot(false)
    }
  }, [])
  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])
  const [smartCardStatus, setSmartCardStatus] = useState(null)
  const [checkingSmartCard, setCheckingSmartCard] = useState(false)
  const checkSmartCard = useCallback(async () => {
    setCheckingSmartCard(true)
    try {
      setSmartCardStatus(await window.api.getSmartCardStatus())
    } finally {
      setCheckingSmartCard(false)
    }
  }, [])
  const [gpsFix, setGpsFix] = useState(null)
  const [checkingGps, setCheckingGps] = useState(false)
  const checkGps = useCallback(async () => {
    setCheckingGps(true)
    setGpsFix(null)
    try {
      setGpsFix(await window.api.getGpsFix())
    } finally {
      setCheckingGps(false)
    }
  }, [])
  const [wifiStatus, setWifiStatus] = useState(null)
  const [checkingWifi, setCheckingWifi] = useState(false)
  const checkWifi = useCallback(async () => {
    setCheckingWifi(true)
    try {
      setWifiStatus(await window.api.getWifiConnectionStatus())
    } finally {
      setCheckingWifi(false)
    }
  }, [])
  const [scanBuffer, setScanBuffer] = useState('')
  const [lastScan, setLastScan] = useState(null)
  const keyTimestampsRef = useRef([])
  const idleTimerRef = useRef(null)
  const resetScanBuffer = useCallback(() => {
    setScanBuffer('')
    keyTimestampsRef.current = []
  }, [])
  const handleScanKeyDown = useCallback(
    (e) => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (e.key === 'Enter') {
        e.preventDefault()
        const timestamps = keyTimestampsRef.current
        if (scanBuffer.length > 0 && timestamps.length >= 2) {
          const intervals = []
          for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1])
          }
          const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
          setLastScan({
            code: scanBuffer,
            avgIntervalMs: Math.round(avg),
            isScanner: avg <= SCAN_MAX_AVG_INTERVAL_MS && scanBuffer.length >= SCAN_MIN_CHARS
          })
        }
        resetScanBuffer()
        return
      }
      if (e.key.length === 1) {
        keyTimestampsRef.current.push(performance.now())
      }
      idleTimerRef.current = setTimeout(resetScanBuffer, SCAN_IDLE_RESET_MS)
    },
    [resetScanBuffer, scanBuffer]
  )
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])
  const smartCardReaders = snapshot?.smartCardReaders ?? []
  const gpsSensors = snapshot?.gpsSensors ?? []
  const barcodeCandidates = snapshot?.barcodeScannerCandidates ?? []
  const radios = snapshot?.radios ?? []
  const wifiRadio = radios.find((r2) => r2.kind === 'wifi') ?? null
  const bluetoothRadio = radios.find((r2) => r2.kind === 'bluetooth') ?? null
  const cellularRadio = radios.find((r2) => r2.kind === 'cellular') ?? null
  // Hardware names ("Intel Wi-Fi 6 AX201", "Sierra Wireless EM7455…") beat the
  // radios' generic ones ("Wi-Fi", "Cellular")
  const adapterNames = snapshot?.adapterNames ?? {}
  const radioDescription = (adapterName, radio, missingText) =>
    adapterName ?? radio?.name ?? missingText
  return (
    <Page
      title="Wireless & peripherals"
      description="Detects and tests less common hardware when this device actually has it."
      actions={
        <Button
          icon={ArrowSyncRegular}
          onClick={() => void loadSnapshot()}
          disabled={loadingSnapshot}
        >
          Scan again
        </Button>
      }
    >
      <Section title="Wireless">
        <DeviceCard
          icon={Wifi1Regular}
          title="Wi-Fi"
          loading={loadingSnapshot}
          description={radioDescription(adapterNames.wifi, wifiRadio, 'No Wi-Fi adapter detected')}
          details={
            !wifiRadio
              ? adapterNames.wifi && (
                  <p className="text-text-secondary">
                    The adapter is installed, but Windows doesn&apos;t report its radio state.
                  </p>
                )
              : wifiStatus &&
                (wifiStatus.error ? (
                  <p className="text-caution">{wifiStatus.error}</p>
                ) : wifiStatus.connected ? (
                  <p>
                    Connected to{' '}
                    <span className="font-semibold">{wifiStatus.ssid ?? 'a network'}</span>
                    {wifiStatus.signalPercent !== null && (
                      <span className="text-text-secondary">
                        {' '}
                        · Signal {wifiStatus.signalPercent}%
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-text-secondary">Not connected to a network.</p>
                ))
          }
        >
          {wifiRadio && (
            <>
              <RadioStateBadge state={wifiRadio.state} />
              <BusyButton busy={checkingWifi} busyText="Checking…" onClick={() => void checkWifi()}>
                Check connection
              </BusyButton>
            </>
          )}
        </DeviceCard>
        <DeviceCard
          icon={BluetoothRegular}
          title="Bluetooth"
          loading={loadingSnapshot}
          description={radioDescription(
            adapterNames.bluetooth,
            bluetoothRadio,
            'No Bluetooth adapter detected'
          )}
          details={
            !bluetoothRadio &&
            adapterNames.bluetooth && (
              <p className="text-text-secondary">
                The adapter is installed, but Windows doesn&apos;t report its radio state.
              </p>
            )
          }
        >
          {bluetoothRadio && <RadioStateBadge state={bluetoothRadio.state} />}
        </DeviceCard>
        <DeviceCard
          icon={CellularData1Regular}
          title="Mobile broadband (4G)"
          loading={loadingSnapshot}
          description={radioDescription(
            adapterNames.cellular,
            cellularRadio,
            "No modem detected (most laptops and desktops don't have one)"
          )}
          details={
            !cellularRadio &&
            adapterNames.cellular && (
              <p className="text-text-secondary">
                The modem is installed, but Windows doesn&apos;t report its radio state.
              </p>
            )
          }
        >
          {cellularRadio && <RadioStateBadge state={cellularRadio.state} />}
        </DeviceCard>
      </Section>

      <Section title="Peripherals">
        <DeviceCard
          icon={ContactCardRegular}
          title="Smart card reader"
          loading={loadingSnapshot}
          description={
            smartCardReaders.length > 0
              ? smartCardReaders.map((r2) => r2.name).join(' · ')
              : 'No smart card reader in Device Manager'
          }
          details={
            smartCardStatus && (
              <div className="flex flex-col gap-2">
                {smartCardStatus.error && <p className="text-caution">{smartCardStatus.error}</p>}
                {smartCardStatus.readers.map((r2) => (
                  <div key={r2.name} className="flex items-center justify-between gap-3">
                    <span className="truncate">{r2.name}</span>
                    <Badge tone={r2.cardPresent ? 'success' : 'neutral'}>
                      {r2.cardPresent ? 'Card present' : 'No card'}
                    </Badge>
                  </div>
                ))}
              </div>
            )
          }
        >
          {smartCardReaders.length > 0 && (
            <BusyButton
              busy={checkingSmartCard}
              busyText="Checking…"
              onClick={() => void checkSmartCard()}
            >
              Check card
            </BusyButton>
          )}
        </DeviceCard>
        <DeviceCard
          icon={LocationRippleRegular}
          title="GPS"
          loading={loadingSnapshot}
          description={
            gpsSensors.length > 0
              ? gpsSensors.map((s) => s.name).join(' · ')
              : 'No dedicated GPS sensor (most laptops locate themselves over Wi-Fi)'
          }
          details={
            gpsFix &&
            (gpsFix.error ? (
              <p className="text-caution">{gpsFix.error}</p>
            ) : gpsFix.latitude !== null && gpsFix.longitude !== null ? (
              <p>
                <span className="selectable font-semibold">
                  {gpsFix.latitude.toFixed(5)}, {gpsFix.longitude.toFixed(5)}
                </span>
                <span className="text-text-secondary">
                  {' '}
                  · ±{Math.round(gpsFix.accuracyMeters ?? 0)} m · Source:{' '}
                  {gpsFix.source ?? 'unknown'}
                </span>
              </p>
            ) : (
              <p className="text-text-secondary">No fix.</p>
            ))
          }
        >
          {gpsSensors.length > 0 && (
            <BusyButton busy={checkingGps} busyText="Locating…" onClick={() => void checkGps()}>
              Get a fix
            </BusyButton>
          )}
        </DeviceCard>
        <DeviceCard
          icon={QrCodeRegular}
          title="Barcode / QR scanner"
          description={
            barcodeCandidates.length > 0
              ? `Possible match: ${barcodeCandidates[0].name}`
              : 'Works with any scanner; no specific device required'
          }
          details={
            <div className="flex flex-col gap-3">
              <p className="text-caption text-text-secondary">
                Most scanners act as a keyboard, so they can&apos;t be detected in advance. Click
                the box and scan a code: scanners type far faster than a person, which is how the
                test tells them apart.
              </p>
              <TextBox
                id="barcode-input"
                aria-label="Scanned code"
                value={scanBuffer}
                onChange={(e) => setScanBuffer(e.target.value)}
                onKeyDown={handleScanKeyDown}
                placeholder="Click here and scan a code…"
                className="max-w-md"
              />
              {lastScan && (
                <InfoBar
                  severity={lastScan.isScanner ? 'success' : 'warning'}
                  title={lastScan.isScanner ? 'Scanner detected.' : 'Looks like manual typing.'}
                >
                  <span className="selectable font-semibold">{lastScan.code}</span> · ~
                  {lastScan.avgIntervalMs} ms between keys
                  {!lastScan.isScanner && '. Try scanning instead.'}
                </InfoBar>
              )}
            </div>
          }
        />
      </Section>
    </Page>
  )
}
