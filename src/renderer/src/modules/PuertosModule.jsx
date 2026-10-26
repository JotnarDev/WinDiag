import { Cable, RefreshCw, Usb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePortsContext } from '@/context/PortsContext'
import { cn } from '@/lib/utils'

export function PuertosModule() {
  const { snapshot, isLoading, recentlyConnected, refresh: load } = usePortsContext()
  const usbDevices = snapshot?.usbDevices ?? []
  const ethernetPorts = snapshot?.ethernet ?? []
  const isInitialLoad = snapshot === null
  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Ports</h1>
          <p className="text-sm text-zinc-500">
            Snapshot of USB and network ports. Plug or unplug a device, then click Refresh to see
            the change — anything newly detected is highlighted.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Usb className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>USB</CardTitle>
              <CardDescription>
                {
                  "Every USB device Windows currently detects as connected (internal hub/controller entries are hidden — those aren't real ports)"
                }
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isInitialLoad ? (
              <p className="text-sm text-zinc-500">Detecting devices…</p>
            ) : usbDevices.length === 0 ? (
              <p className="text-sm text-zinc-500">No USB device is currently connected.</p>
            ) : (
              <ul className="space-y-2">
                {usbDevices.map((device) => {
                  const isNew = Boolean(recentlyConnected[device.id])
                  const subtitle = [device.manufacturer, device.type]
                    .filter((part) => Boolean(part))
                    .join(' · ')
                  return (
                    <li
                      key={device.id}
                      className={cn(
                        'flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors',
                        isNew
                          ? 'border-emerald-800/60 bg-emerald-950/40'
                          : 'border-zinc-800 bg-zinc-900/60'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-200">{device.name}</p>
                        {subtitle && <p className="truncate text-xs text-zinc-500">{subtitle}</p>}
                      </div>
                      {isNew && (
                        <span className="ml-3 shrink-0 rounded-full bg-emerald-950/60 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          Connected
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Cable className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>Network / Ethernet</CardTitle>
              <CardDescription>Cable status for each wired network port</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isInitialLoad ? (
              <p className="text-sm text-zinc-500">Detecting network ports…</p>
            ) : ethernetPorts.length === 0 ? (
              <p className="text-sm text-zinc-500">
                This device has no detectable wired network ports.
              </p>
            ) : (
              <ul className="space-y-2">
                {ethernetPorts.map((port) => (
                  <li
                    key={port.id}
                    className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-200">{port.name}</p>
                      {port.macAddress && (
                        <p className="truncate text-xs text-zinc-500">{port.macAddress}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'ml-3 flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                        port.connected
                          ? 'bg-emerald-950/60 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-400'
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          port.connected ? 'bg-emerald-500' : 'bg-zinc-400'
                        )}
                      />
                      {port.connected
                        ? `Connected${port.speedMbps ? ` · ${port.speedMbps} Mbps` : ''}`
                        : 'No cable'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
