import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bluetooth,
  CreditCard,
  LoaderCircle,
  QrCode,
  RotateCcw,
  Satellite,
  Signal,
  Wifi
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const RADIO_STATE_LABEL = {
  on: 'Connected',
  off: 'Off',
  disabled: 'Disabled',
  unknown: 'Unknown'
}

const RADIO_STATE_CLASS = {
  on: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400',
  off: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
  disabled: 'border-amber-900/50 bg-amber-950/40 text-amber-400',
  unknown: 'border-zinc-700 bg-zinc-800/60 text-zinc-400'
}

function RadioStateBadge({ state }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        RADIO_STATE_CLASS[state]
      )}
    >
      {RADIO_STATE_LABEL[state]}
    </span>
  )
}

const SCAN_MAX_AVG_INTERVAL_MS = 30
const SCAN_MIN_CHARS = 3
const SCAN_IDLE_RESET_MS = 600
export function OtrosModule() {
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
  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Other devices</h1>
          <p className="text-sm text-zinc-500">
            Detects and tests less common peripherals when this machine actually has them: Wi-Fi,
            Bluetooth and mobile broadband (4G) adapters, a smart card reader, a real GPS sensor, or
            a barcode/QR scanner.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadSnapshot()} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Re-scan devices
        </Button>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Wifi className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>Wi-Fi</CardTitle>
              <CardDescription>
                {loadingSnapshot
                  ? 'Detecting…'
                  : wifiRadio
                    ? wifiRadio.name
                    : 'No Wi-Fi adapter detected'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingSnapshot ? (
              <p className="text-sm text-zinc-500">Detecting…</p>
            ) : !wifiRadio ? (
              <p className="text-sm text-zinc-500">
                {"This machine doesn't report a Wi-Fi radio."}
              </p>
            ) : (
              <>
                <RadioStateBadge state={wifiRadio.state} />
                <div>
                  <Button
                    size="sm"
                    onClick={() => void checkWifi()}
                    disabled={checkingWifi}
                    className="gap-2"
                  >
                    {checkingWifi && <LoaderCircle className="h-4 w-4 animate-spin" />}Check network
                  </Button>
                </div>
                {wifiStatus && (
                  <div className="space-y-1 text-xs">
                    {wifiStatus.error ? (
                      <p className="text-amber-400">{wifiStatus.error}</p>
                    ) : wifiStatus.connected ? (
                      <>
                        <p className="font-medium text-zinc-300">
                          {wifiStatus.ssid ?? 'Connected'}
                        </p>
                        {wifiStatus.signalPercent !== null && (
                          <p className="text-zinc-500">
                            {'Signal: '}
                            {wifiStatus.signalPercent}%
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-zinc-500">Not connected to a network.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Bluetooth className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>Bluetooth</CardTitle>
              <CardDescription>
                {loadingSnapshot
                  ? 'Detecting…'
                  : bluetoothRadio
                    ? bluetoothRadio.name
                    : 'No Bluetooth adapter detected'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSnapshot ? (
              <p className="text-sm text-zinc-500">Detecting…</p>
            ) : !bluetoothRadio ? (
              <p className="text-sm text-zinc-500">
                {"This machine doesn't report a Bluetooth radio."}
              </p>
            ) : (
              <RadioStateBadge state={bluetoothRadio.state} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Signal className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>Mobile broadband (4G)</CardTitle>
              <CardDescription>
                {loadingSnapshot
                  ? 'Detecting…'
                  : cellularRadio
                    ? cellularRadio.name
                    : 'No mobile broadband adapter detected'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSnapshot ? (
              <p className="text-sm text-zinc-500">Detecting…</p>
            ) : !cellularRadio ? (
              <p className="text-sm text-zinc-500">
                {
                  "Most laptops and desktops don't have a built-in cellular modem — this machine doesn't report one."
                }
              </p>
            ) : (
              <RadioStateBadge state={cellularRadio.state} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CreditCard className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>Smart card reader</CardTitle>
              <CardDescription>
                {loadingSnapshot
                  ? 'Detecting…'
                  : smartCardReaders.length > 0
                    ? `${smartCardReaders.length} reader(s) detected`
                    : 'No smart card reader detected'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingSnapshot ? (
              <p className="text-sm text-zinc-500">Detecting…</p>
            ) : smartCardReaders.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {"This machine doesn't report a smart card reader in Device Manager."}
              </p>
            ) : (
              <>
                <ul className="space-y-1 text-xs text-zinc-500">
                  {smartCardReaders.map((r2) => (
                    <li key={r2.id} className="truncate">
                      {r2.name}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  onClick={() => void checkSmartCard()}
                  disabled={checkingSmartCard}
                  className="gap-2"
                >
                  {checkingSmartCard && <LoaderCircle className="h-4 w-4 animate-spin" />}Check card
                  status
                </Button>
                {smartCardStatus && (
                  <div className="space-y-1.5">
                    {smartCardStatus.error && (
                      <p className="text-xs text-amber-400">{smartCardStatus.error}</p>
                    )}
                    {smartCardStatus.readers.map((r2) => (
                      <div
                        key={r2.name}
                        className={cn(
                          'flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs',
                          r2.cardPresent
                            ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400'
                            : 'border-zinc-700 bg-zinc-800/60 text-zinc-400'
                        )}
                      >
                        <span className="truncate">{r2.name}</span>
                        <span className="ml-2 shrink-0 font-medium">
                          {r2.cardPresent ? 'Card present' : 'No card'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Satellite className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>GPS</CardTitle>
              <CardDescription>
                {loadingSnapshot
                  ? 'Detecting…'
                  : gpsSensors.length > 0
                    ? `${gpsSensors.length} GPS sensor(s) detected`
                    : 'No dedicated GPS sensor detected'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingSnapshot ? (
              <p className="text-sm text-zinc-500">Detecting…</p>
            ) : gpsSensors.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Most laptops resolve location over Wi-Fi instead of real GPS hardware — this machine
                has no dedicated GPS sensor listed in Device Manager.
              </p>
            ) : (
              <>
                <ul className="space-y-1 text-xs text-zinc-500">
                  {gpsSensors.map((s) => (
                    <li key={s.id} className="truncate">
                      {s.name}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  onClick={() => void checkGps()}
                  disabled={checkingGps}
                  className="gap-2"
                >
                  {checkingGps && <LoaderCircle className="h-4 w-4 animate-spin" />}Get a fix
                </Button>
                {gpsFix && (
                  <div className="space-y-1 text-xs">
                    {gpsFix.error ? (
                      <p className="text-amber-400">{gpsFix.error}</p>
                    ) : gpsFix.latitude !== null && gpsFix.longitude !== null ? (
                      <>
                        <p className="font-medium text-zinc-300">
                          {gpsFix.latitude.toFixed(5)}
                          {', '}
                          {gpsFix.longitude.toFixed(5)}
                        </p>
                        <p className="text-zinc-500">
                          Accuracy: ±{Math.round(gpsFix.accuracyMeters ?? 0)}
                          {' m · Source:'} {gpsFix.source ?? 'unknown'}
                        </p>
                      </>
                    ) : (
                      <p className="text-zinc-500">No fix.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <QrCode className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>Barcode / QR scanner</CardTitle>
              <CardDescription>
                {barcodeCandidates.length > 0
                  ? `Possible match: ${barcodeCandidates[0].name}`
                  : 'Works with any scanner — no specific device required'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-zinc-500">
              {
                "Most scanners connect as a plain keyboard, so there's no reliable way to detect one in advance. Click the box below and scan a code — real scanners type far faster than a person can, which is how this test tells them apart."
              }
            </p>
            <input
              type="text"
              value={scanBuffer}
              onChange={(e) => setScanBuffer(e.target.value)}
              onKeyDown={handleScanKeyDown}
              placeholder="Click here and scan a code…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-primary focus:outline-none"
            />
            {lastScan && (
              <div
                className={cn(
                  'rounded-md border px-3 py-2 text-xs',
                  lastScan.isScanner
                    ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400'
                    : 'border-amber-900/50 bg-amber-950/40 text-amber-400'
                )}
              >
                <p className="truncate font-medium">{lastScan.code}</p>
                <p>
                  {lastScan.isScanner
                    ? `Detected as a scanner (~${lastScan.avgIntervalMs} ms between keys)`
                    : `Looks like manual typing (~${lastScan.avgIntervalMs} ms between keys) — try scanning instead`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
