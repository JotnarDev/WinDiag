import { useEffect, useState } from 'react'
import {
  ArrowResetRegular,
  CheckmarkCircleFilled,
  CircleRegular,
  EyeOffRegular,
  PauseRegular,
  PlayRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card, Section } from '@/components/ui/Card'
import { Badge, InfoBar, ProgressBar, ProgressRing } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'

const POLL_MS = 1500

function PortCard({ port, number, result, isActive, onIgnore }) {
  return (
    <li
      className={cn(
        'flex min-h-[68px] items-center gap-3 rounded-overlay border px-4 py-3 transition-colors duration-200',
        result ? 'border-card-stroke bg-success-bg' : 'border-card-stroke bg-card'
      )}
    >
      {result ? (
        <CheckmarkCircleFilled aria-hidden className="size-5 shrink-0 text-success" />
      ) : (
        <CircleRegular aria-hidden className="size-5 shrink-0 text-text-tertiary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          Port {number}
          {port.typeC && <Badge>USB-C</Badge>}
          {result?.superSpeed && <Badge>USB 3</Badge>}
        </p>
        <p className="truncate text-caption text-text-secondary">
          {result
            ? [result.deviceName, result.wasConnectedAtStart && 'already connected']
                .filter(Boolean)
                .join(' · ')
            : isActive
              ? 'Waiting for a device…'
              : 'Not tested'}
        </p>
      </div>
      {!result && (
        <Button
          variant="subtle"
          icon={EyeOffRegular}
          aria-label={`Ignore port ${number}`}
          title="Ignore this port (not a real external port)"
          onClick={onIgnore}
        />
      )}
    </li>
  )
}

export function PortsModule() {
  const [isActive, setIsActive] = useState(false)
  // null until the first scan; then { supported, ports }
  const [scan, setScan] = useState(null)
  // port id → { deviceName, superSpeed, wasConnectedAtStart }
  const [tested, setTested] = useState({})
  const [ignored, setIgnored] = useState(() => new Set())

  const ports = (scan?.ports ?? []).filter((p) => !ignored.has(p.id))
  const testedCount = ports.filter((p) => tested[p.id]).length
  const isComplete = ports.length > 0 && testedCount === ports.length

  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    let timeoutId = null
    let isFirstScan = true

    async function poll() {
      if (!document.hidden) {
        try {
          const result = await window.api.getUsbPorts()
          if (cancelled) return
          setScan(result)
          const wasConnectedAtStart = isFirstScan
          isFirstScan = false
          setTested((prev) => {
            let next = prev
            for (const port of result.ports) {
              if (!port.connected || prev[port.id]) continue
              if (next === prev) next = { ...prev }
              next[port.id] = {
                deviceName: port.deviceName,
                superSpeed: port.superSpeed,
                wasConnectedAtStart
              }
            }
            return next
          })
        } catch {
          // a failed scan just waits for the next round
        }
      }
      if (!cancelled) timeoutId = setTimeout(() => void poll(), POLL_MS)
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isActive])

  // Stop scanning once every port has had something plugged in
  useEffect(() => {
    if (isActive && isComplete) setIsActive(false)
  }, [isActive, isComplete])

  const reset = () => {
    setIsActive(false)
    setScan(null)
    setTested({})
    setIgnored(new Set())
  }

  return (
    <Page
      title="USB ports"
      description="Finds this device's USB ports (USB-A and USB-C) and checks that each one detects a device."
      actions={
        <>
          {!isActive && !isComplete && (
            <Button variant="accent" icon={PlayRegular} onClick={() => setIsActive(true)}>
              {scan ? 'Resume' : 'Start test'}
            </Button>
          )}
          {isActive && (
            <Button icon={PauseRegular} onClick={() => setIsActive(false)}>
              Pause
            </Button>
          )}
          {scan && (
            <Button icon={ArrowResetRegular} onClick={reset}>
              Reset
            </Button>
          )}
        </>
      }
    >
      {scan === null && !isActive && (
        <InfoBar severity="info">
          Start the test, then plug a device (a USB stick or mouse) into each port, in any order.
          Every port turns green once something is detected on it; ports that already have something
          plugged in count as tested.
        </InfoBar>
      )}
      {isActive && scan === null && (
        <Card className="flex items-center gap-3 px-4 py-5 text-text-secondary">
          <ProgressRing size={16} label="Detecting ports" />
          Detecting USB ports…
        </Card>
      )}
      {scan && !scan.supported && (
        <InfoBar severity="error">Couldn&apos;t read the USB ports on this device.</InfoBar>
      )}
      {scan?.supported && scan.ports.length === 0 && (
        <InfoBar severity="warning">No user-accessible USB ports were reported.</InfoBar>
      )}
      {ports.length > 0 && (
        <>
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <span className="font-display text-subtitle font-semibold">
                  {testedCount} of {ports.length}
                </span>{' '}
                <span className="text-text-secondary">ports tested</span>
              </p>
              {isActive && (
                <span className="flex items-center gap-2 text-text-secondary">
                  <ProgressRing size={16} label="Scanning" />
                  Scanning…
                </span>
              )}
            </div>
            <ProgressBar
              label="Ports tested"
              value={(testedCount / ports.length) * 100}
              tone={isComplete ? 'success' : 'accent'}
            />
          </Card>
          {isComplete && (
            <InfoBar severity="success" className="mt-3">
              All {ports.length} USB ports detected a device.
            </InfoBar>
          )}
          <Section title="Ports" className="mt-7">
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ports.map((port) => (
                <PortCard
                  key={port.id}
                  port={port}
                  // numbered over all detected ports, so ignoring one doesn't renumber the rest
                  number={scan.ports.indexOf(port) + 1}
                  result={tested[port.id]}
                  isActive={isActive}
                  onIgnore={() => setIgnored((prev) => new Set(prev).add(port.id))}
                />
              ))}
            </ul>
          </Section>
        </>
      )}
    </Page>
  )
}
