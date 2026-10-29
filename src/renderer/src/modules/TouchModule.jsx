import { useCallback, useEffect, useRef, useState } from 'react'
import { DismissRegular, EraserRegular, TapSingleRegular } from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { InfoBar } from '@/components/ui/feedback'

const TRAIL_COLORS = [
  '#22d3ee',
  '#f472b6',
  '#a3e635',
  '#fbbf24',
  '#818cf8',
  '#fb7185',
  '#34d399',
  '#f97316'
]

export function TouchModule() {
  const [isActive, setIsActive] = useState(false)
  const [activePoints, setActivePoints] = useState(0)
  const [maxPoints, setMaxPoints] = useState(0)
  // null while the request is pending, then whether Windows actually blocked them
  const [edgeGesturesBlocked, setEdgeGesturesBlocked] = useState(null)
  const canvasRef = useRef(null)
  const pointersRef = useRef(new Map())
  const colorIndexRef = useRef(0)
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Size the backing store in physical pixels: at 125–150% display scaling
    // a CSS-pixel canvas gets stretched and the trails look blurry.
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(window.innerWidth * dpr)
    canvas.height = Math.round(window.innerHeight * dpr)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 4
    }
  }, [])
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }, [])
  const isActiveRef = useRef(false)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])
  const exitTest = useCallback(() => {
    setIsActive(false)
    void window.api.setFullscreen(false)
    void window.api.setEdgeGesturesDisabled(false)
    pointersRef.current.clear()
    setActivePoints(0)
  }, [])
  const startTest = useCallback(() => {
    colorIndexRef.current = 0
    pointersRef.current.clear()
    setActivePoints(0)
    setMaxPoints(0)
    setIsActive(true)
    setEdgeGesturesBlocked(null)
    void window.api.setFullscreen(true)
    void window.api
      .setEdgeGesturesDisabled(true)
      .then((result) => setEdgeGesturesBlocked(Boolean(result?.applied)))
      .catch(() => setEdgeGesturesBlocked(false))
  }, [])
  useEffect(() => {
    return () => {
      if (!isActiveRef.current) return
      void window.api.setFullscreen(false)
      void window.api.setEdgeGesturesDisabled(false)
    }
  }, [])
  useEffect(() => {
    if (!isActive) return
    const canvas = canvasRef.current
    if (!canvas) return
    resizeCanvas()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const canvasEl = canvas
    const ctx2d = ctx
    function handlePointerDown(e) {
      canvasEl.setPointerCapture(e.pointerId)
      const color = TRAIL_COLORS[colorIndexRef.current % TRAIL_COLORS.length]
      colorIndexRef.current += 1
      pointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        color
      })
      setActivePoints(pointersRef.current.size)
      setMaxPoints((max) => Math.max(max, pointersRef.current.size))
      ctx2d.fillStyle = color
      ctx2d.beginPath()
      ctx2d.arc(e.clientX, e.clientY, 3, 0, Math.PI * 2)
      ctx2d.fill()
    }
    function handlePointerMove(e) {
      const point = pointersRef.current.get(e.pointerId)
      if (!point) return
      ctx2d.strokeStyle = point.color
      ctx2d.beginPath()
      ctx2d.moveTo(point.x, point.y)
      ctx2d.lineTo(e.clientX, e.clientY)
      ctx2d.stroke()
      point.x = e.clientX
      point.y = e.clientY
    }
    function handlePointerEnd(e) {
      if (pointersRef.current.delete(e.pointerId)) {
        setActivePoints(pointersRef.current.size)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') exitTest()
      else if (e.key === ' ') clearCanvas()
    }
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerEnd)
    canvas.addEventListener('pointercancel', handlePointerEnd)
    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerEnd)
      canvas.removeEventListener('pointercancel', handlePointerEnd)
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, exitTest, clearCanvas, resizeCanvas])
  if (isActive) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black"
        style={{ touchAction: 'none', colorScheme: 'dark' }}
      >
        <canvas
          ref={canvasRef}
          // Explicit CSS size: without it the canvas displays at its physical-pixel
          // size (1.5× the screen at 150% scaling) and trails drift off the finger.
          className="absolute inset-0 h-full w-full"
          style={{ touchAction: 'none' }}
        />
        {/* Touch-friendly controls, so the test can be left without a keyboard */}
        <div className="absolute top-1/2 right-4 flex -translate-y-1/2 flex-col gap-2">
          <button
            type="button"
            aria-label="Clear the canvas"
            title="Clear (Space)"
            onClick={clearCanvas}
            className="flex size-12 items-center justify-center rounded-full border border-white/15 bg-[#2c2c2c]/90 text-white hover:bg-[#3a3a3a]"
          >
            <EraserRegular className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Exit test"
            title="Exit (Esc)"
            onClick={exitTest}
            className="flex size-12 items-center justify-center rounded-full border border-white/15 bg-[#2c2c2c]/90 text-white hover:bg-[#3a3a3a]"
          >
            <DismissRegular className="size-5" />
          </button>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
          <div className="rounded-overlay border border-white/10 bg-[#2c2c2c]/90 px-4 py-2 text-center text-white">
            <span className="font-semibold">{activePoints}</span> active ·{' '}
            <span className="font-semibold">{maxPoints}</span> max simultaneous
            {edgeGesturesBlocked === false && (
              <span className="block text-caption text-[#fce100]">
                Edge swipes are still active (run as administrator to block them)
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }
  return (
    <Page
      title="Touch"
      description="Draws the trail of every contact point to check the digitizer's accuracy, continuity and multi-touch."
    >
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <TapSingleRegular aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div>
            <p>Full-screen touch canvas</p>
            <p className="text-caption text-text-secondary">
              Drag one or more fingers across the whole screen, edges and corners included. Each
              finger draws in its own color: gaps in a line point to dead zones, and the counter
              shows how many simultaneous touches the screen supports. Use the buttons on the right
              edge (or Space / Esc) to clear or exit.
            </p>
          </div>
        </div>
        <InfoBar severity="info" className="sm:ml-9">
          When WinDiag runs as administrator, Windows&apos; edge-swipe gestures (notifications,
          widgets, Task View) are turned off during the test so they don&apos;t interrupt it.
        </InfoBar>
        <div className="sm:pl-9">
          <Button variant="accent" onClick={startTest}>
            Start touch test
          </Button>
        </div>
      </Card>
    </Page>
  )
}
