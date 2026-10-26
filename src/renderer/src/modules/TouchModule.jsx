import { useCallback, useEffect, useRef, useState } from 'react'
import { FingerprintPattern } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
  const canvasRef = useRef(null)
  const pointersRef = useRef(new Map())
  const colorIndexRef = useRef(0)
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
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
    setIsActive(true)
    void window.api.setFullscreen(true)
    void window.api.setEdgeGesturesDisabled(true)
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
        style={{
          touchAction: 'none'
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            touchAction: 'none'
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-md bg-black/70 px-4 py-2 text-sm text-white">
            {'Active points: '}
            {activePoints}
            {' · Space to clear · Esc to exit · Windows edge-swipe gestures disabled'}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Touch test</h1>
        <p className="text-sm text-zinc-500">
          Full-screen black canvas that draws the trail left by each contact point, to verify the
          continuity and accuracy of the touch digitizer.
        </p>
      </header>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <FingerprintPattern className="h-5 w-5 text-zinc-400" />
          <div>
            <CardTitle>Start test</CardTitle>
            <CardDescription>
              {
                "Touch and drag with one or more fingers to draw on the screen. Each contact point is drawn in a different color (useful for detecting dead zones or gaps in the trail). Windows' edge-swipe gestures (Action Center, Task View, Start) are temporarily disabled while the test is active, so swiping in from the edge of the screen doesn't interrupt it. Press Space to clear the canvas and Esc to exit."
              }
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={startTest}>Start touch test</Button>
        </CardContent>
      </Card>
    </div>
  )
}
