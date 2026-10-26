import { useCallback, useEffect, useState } from 'react'
import { Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const TEST_COLORS = [
  {
    name: 'White',
    hex: '#ffffff'
  },
  {
    name: 'Black',
    hex: '#000000'
  },
  {
    name: 'Red',
    hex: '#ff0000'
  },
  {
    name: 'Green',
    hex: '#00ff00'
  },
  {
    name: 'Blue',
    hex: '#0000ff'
  },
  {
    name: 'Medium gray',
    hex: '#808080'
  }
]

export function PantallaModule() {
  const [isActive, setIsActive] = useState(false)
  const [colorIndex, setColorIndex] = useState(0)
  const exitTest = useCallback(() => {
    setIsActive(false)
    void window.api.setFullscreen(false)
  }, [])
  const startTest = useCallback(() => {
    setColorIndex(0)
    setIsActive(true)
    void window.api.setFullscreen(true)
  }, [])
  const nextColor = useCallback(() => {
    setColorIndex((i) => (i + 1) % TEST_COLORS.length)
  }, [])
  const prevColor = useCallback(() => {
    setColorIndex((i) => (i - 1 + TEST_COLORS.length) % TEST_COLORS.length)
  }, [])
  useEffect(() => {
    if (!isActive) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') exitTest()
      else if (e.key === 'ArrowRight' || e.key === ' ') nextColor()
      else if (e.key === 'ArrowLeft') prevColor()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, exitTest, nextColor, prevColor])
  if (isActive) {
    const current = TEST_COLORS[colorIndex]
    return (
      <div
        className="fixed inset-0 z-50 flex cursor-pointer items-end justify-center"
        style={{
          backgroundColor: current.hex
        }}
        onClick={nextColor}
      >
        <div className="mb-6 rounded-md bg-black/40 px-4 py-2 text-sm text-white backdrop-blur-sm">
          {current.name}
          {' · click or arrow keys to change · Esc to exit'}
        </div>
      </div>
    )
  }
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Display test</h1>
        <p className="text-sm text-zinc-500">
          Shows solid colors in full screen to detect dead pixels or light bleed on the panel.
        </p>
      </header>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Monitor className="h-5 w-5 text-zinc-400" />
          <div>
            <CardTitle>Start test</CardTitle>
            <CardDescription>
              The window will switch to full screen showing solid colors in sequence (white, black,
              red, green, blue, gray). Use the arrow keys or click to change color, and Esc to exit.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={startTest}>Start display test</Button>
          <div className="flex items-center gap-2">
            {TEST_COLORS.map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="h-6 w-6 rounded border border-zinc-700"
                style={{
                  backgroundColor: c.hex
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
