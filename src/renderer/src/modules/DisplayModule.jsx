import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  DesktopRegular,
  DismissRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

const TEST_COLORS = [
  { name: 'White', hex: '#ffffff', hint: 'dark (dead) pixels' },
  { name: 'Black', hex: '#000000', hint: 'stuck pixels and light bleed at the edges' },
  { name: 'Red', hex: '#ff0000', hint: 'pixels with a missing red subpixel' },
  { name: 'Green', hex: '#00ff00', hint: 'pixels with a missing green subpixel' },
  { name: 'Blue', hex: '#0000ff', hint: 'pixels with a missing blue subpixel' },
  { name: 'Medium gray', hex: '#808080', hint: 'uneven brightness (clouding)' }
]

// The controls hide so they don't cover the pixels being inspected
const CONTROLS_HIDE_MS = 2500

export function DisplayModule() {
  const [isActive, setIsActive] = useState(false)
  const [colorIndex, setColorIndex] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef(null)
  const showControls = useCallback(() => {
    setControlsVisible(true)
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS)
  }, [])
  const exitTest = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    setIsActive(false)
    void window.api.setFullscreen(false)
  }, [])
  const startTest = useCallback(
    (index = 0) => {
      setColorIndex(index)
      setIsActive(true)
      showControls()
      void window.api.setFullscreen(true)
    },
    [showControls]
  )
  const step = useCallback((delta) => {
    setColorIndex((i) => (i + delta + TEST_COLORS.length) % TEST_COLORS.length)
  }, [])
  useEffect(() => {
    if (!isActive) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') exitTest()
      else if (e.key === 'ArrowRight' || e.key === ' ') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, exitTest, step])
  useEffect(() => () => clearTimeout(hideTimerRef.current), [])

  if (isActive) {
    const current = TEST_COLORS[colorIndex]
    return (
      <div
        className={cn('fixed inset-0 z-50', !controlsVisible && 'cursor-none')}
        style={{ backgroundColor: current.hex }}
        onPointerMove={showControls}
        onClick={() => {
          step(1)
          showControls()
        }}
      >
        <div
          className={cn(
            'absolute inset-x-0 bottom-8 flex justify-center transition-opacity duration-300',
            controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          {/* Always dark so it reads on every test color */}
          <div
            className="flex items-center gap-1 rounded-overlay border border-white/10 bg-[#2c2c2c]/90 p-1 text-white shadow-flyout"
            style={{ colorScheme: 'dark' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Previous color"
              className="flex size-10 items-center justify-center rounded-control hover:bg-white/10"
              onClick={() => step(-1)}
            >
              <ChevronLeftRegular className="size-5" />
            </button>
            <div className="min-w-44 px-2 text-center">
              <p className="font-semibold">
                {current.name}{' '}
                <span className="font-normal text-white/70">
                  {colorIndex + 1}/{TEST_COLORS.length}
                </span>
              </p>
              <p className="text-caption text-white/70">Look for {current.hint}</p>
            </div>
            <button
              type="button"
              aria-label="Next color"
              className="flex size-10 items-center justify-center rounded-control hover:bg-white/10"
              onClick={() => step(1)}
            >
              <ChevronRightRegular className="size-5" />
            </button>
            <div className="mx-1 h-6 w-px bg-white/20" />
            <button
              type="button"
              aria-label="Exit test"
              className="flex size-10 items-center justify-center rounded-control hover:bg-white/10"
              onClick={exitTest}
            >
              <DismissRegular className="size-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <Page
      title="Display"
      description="Fills the screen with solid colors to reveal dead or stuck pixels, light bleed and uneven backlight."
    >
      <Card className="flex flex-col gap-5 p-5">
        <div className="flex items-start gap-4">
          <DesktopRegular aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div>
            <p>Full-screen color test</p>
            <p className="text-caption text-text-secondary">
              Click, tap or press → / Space for the next color, ← for the previous one, and Esc or ✕
              to exit. The controls hide after a moment so they don&apos;t cover the panel.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:pl-9">
          {TEST_COLORS.map((c, i) => (
            <button
              key={c.name}
              type="button"
              onClick={() => startTest(i)}
              className="group flex flex-col items-center gap-1.5 rounded-control p-1 hover:bg-subtle-hover"
            >
              <span
                className="h-10 w-14 rounded-control border border-control-stroke shadow-card"
                style={{ backgroundColor: c.hex }}
              />
              <span className="text-caption text-text-secondary group-hover:text-text-primary">
                {c.name}
              </span>
            </button>
          ))}
        </div>
        <div className="sm:pl-9">
          <Button variant="accent" onClick={() => startTest(0)}>
            Start display test
          </Button>
        </div>
      </Card>
    </Page>
  )
}
