import { useEffect, useState } from 'react'
import { Fan, Thermometer, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const POLL_MS = 4e3
export function VentiladoresModule() {
  const [info, setInfo] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let cancelled = false
    let timeoutId = null
    async function poll() {
      try {
        const data = await window.api.getFanInfo()
        if (!cancelled) {
          setInfo(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout(() => void poll(), POLL_MS)
        }
      }
    }
    void poll()
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])
  const isLoading = info === null && !error
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Fans</h1>
        <p className="text-sm text-zinc-500">
          {
            "Monitors the RPM reported by the device firmware via WMI. Read-only: Windows doesn't offer a standard way to control fan speed on most hardware, especially laptops."
          }
        </p>
      </header>
      {error && (
        <Card className="mb-4 border-red-900/50 bg-red-950/40">
          <CardContent className="py-4 text-sm text-red-400">
            {'Could not read fan information: '}
            {error}
          </CardContent>
        </Card>
      )}
      {isLoading && (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">Reading sensors…</CardContent>
        </Card>
      )}
      {info && !info.supported && (
        <Card>
          <CardContent className="flex items-start gap-3 py-6 text-sm">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium text-zinc-200">
                This device does not report fan RPM via WMI
              </p>
              <p className="mt-1 text-zinc-500">
                {
                  "This is the most common case, especially on laptops: the manufacturer doesn't implement the ACPI method that exposes this reading to the operating system. It's not an app error — most hardware simply doesn't support it in a standard way."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {info && info.supported && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {info.fans.map((fan, i) => (
            <Card key={`${fan.name}-${i}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{fan.name}</CardTitle>
                <Fan className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {fan.rpm !== null ? `${fan.rpm} RPM` : '—'}
                </div>
                <CardDescription>
                  {fan.rpm !== null ? 'Reported speed' : 'RPM not reported by the firmware'}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {info && (info.cpuTempC !== null || info.maxTempC !== null) && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center gap-2">
            <Thermometer className="h-5 w-5 text-zinc-400" />
            <div>
              <CardTitle>Reference temperature</CardTitle>
              <CardDescription>Context for interpreting fan behavior</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex gap-6 text-sm text-zinc-400">
            {info.cpuTempC !== null && (
              <span>
                {'CPU: '}
                {info.cpuTempC}°C
              </span>
            )}
            {info.maxTempC !== null && (
              <span>
                {'Max: '}
                {info.maxTempC}°C
              </span>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
