import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, Maximize, Mouse, RotateCcw, Shrink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const UNIT = 2.75
const FUNCTION_ROW = [
  {
    code: 'Escape',
    label: 'Esc'
  },
  {
    code: '__g1',
    label: '',
    spacer: true,
    width: 1
  },
  {
    code: 'F1',
    label: 'F1'
  },
  {
    code: 'F2',
    label: 'F2'
  },
  {
    code: 'F3',
    label: 'F3'
  },
  {
    code: 'F4',
    label: 'F4'
  },
  {
    code: '__g2',
    label: '',
    spacer: true,
    width: 0.5
  },
  {
    code: 'F5',
    label: 'F5'
  },
  {
    code: 'F6',
    label: 'F6'
  },
  {
    code: 'F7',
    label: 'F7'
  },
  {
    code: 'F8',
    label: 'F8'
  },
  {
    code: '__g3',
    label: '',
    spacer: true,
    width: 0.5
  },
  {
    code: 'F9',
    label: 'F9'
  },
  {
    code: 'F10',
    label: 'F10'
  },
  {
    code: 'F11',
    label: 'F11'
  },
  {
    code: 'F12',
    label: 'F12'
  }
]

const NUMBER_ROW = [
  {
    code: 'Backquote',
    label: '`'
  },
  {
    code: 'Digit1',
    label: '1'
  },
  {
    code: 'Digit2',
    label: '2'
  },
  {
    code: 'Digit3',
    label: '3'
  },
  {
    code: 'Digit4',
    label: '4'
  },
  {
    code: 'Digit5',
    label: '5'
  },
  {
    code: 'Digit6',
    label: '6'
  },
  {
    code: 'Digit7',
    label: '7'
  },
  {
    code: 'Digit8',
    label: '8'
  },
  {
    code: 'Digit9',
    label: '9'
  },
  {
    code: 'Digit0',
    label: '0'
  },
  {
    code: 'Minus',
    label: '-'
  },
  {
    code: 'Equal',
    label: '='
  },
  {
    code: 'Backspace',
    label: '⌫',
    width: 2
  }
]

const QWERTY_ROW = [
  {
    code: 'Tab',
    label: 'Tab',
    width: 1.5
  },
  {
    code: 'KeyQ',
    label: 'Q'
  },
  {
    code: 'KeyW',
    label: 'W'
  },
  {
    code: 'KeyE',
    label: 'E'
  },
  {
    code: 'KeyR',
    label: 'R'
  },
  {
    code: 'KeyT',
    label: 'T'
  },
  {
    code: 'KeyY',
    label: 'Y'
  },
  {
    code: 'KeyU',
    label: 'U'
  },
  {
    code: 'KeyI',
    label: 'I'
  },
  {
    code: 'KeyO',
    label: 'O'
  },
  {
    code: 'KeyP',
    label: 'P'
  },
  {
    code: 'BracketLeft',
    label: '['
  },
  {
    code: 'BracketRight',
    label: ']'
  },
  {
    code: 'Backslash',
    label: '\\',
    width: 1.5
  }
]

const HOME_ROW = [
  {
    code: 'CapsLock',
    label: 'Caps',
    width: 1.75
  },
  {
    code: 'KeyA',
    label: 'A'
  },
  {
    code: 'KeyS',
    label: 'S'
  },
  {
    code: 'KeyD',
    label: 'D'
  },
  {
    code: 'KeyF',
    label: 'F'
  },
  {
    code: 'KeyG',
    label: 'G'
  },
  {
    code: 'KeyH',
    label: 'H'
  },
  {
    code: 'KeyJ',
    label: 'J'
  },
  {
    code: 'KeyK',
    label: 'K'
  },
  {
    code: 'KeyL',
    label: 'L'
  },
  {
    code: 'Semicolon',
    label: ';'
  },
  {
    code: 'Quote',
    label: "'"
  },
  {
    code: 'Enter',
    label: 'Enter',
    width: 2.25
  }
]

const BOTTOM_ROW = [
  {
    code: 'ShiftLeft',
    label: 'Shift',
    width: 2.25
  },
  {
    code: 'KeyZ',
    label: 'Z'
  },
  {
    code: 'KeyX',
    label: 'X'
  },
  {
    code: 'KeyC',
    label: 'C'
  },
  {
    code: 'KeyV',
    label: 'V'
  },
  {
    code: 'KeyB',
    label: 'B'
  },
  {
    code: 'KeyN',
    label: 'N'
  },
  {
    code: 'KeyM',
    label: 'M'
  },
  {
    code: 'Comma',
    label: ','
  },
  {
    code: 'Period',
    label: '.'
  },
  {
    code: 'Slash',
    label: '/'
  },
  {
    code: 'ShiftRight',
    label: 'Shift',
    width: 2.75
  }
]

const SPACE_ROW = [
  {
    code: 'ControlLeft',
    label: 'Ctrl',
    width: 1.25
  },
  {
    code: 'MetaLeft',
    label: 'Win',
    width: 1.25
  },
  {
    code: 'AltLeft',
    label: 'Alt',
    width: 1.25
  },
  {
    code: 'Space',
    label: 'Space',
    width: 6.25
  },
  {
    code: 'AltRight',
    label: 'Alt',
    width: 1.25
  },
  {
    code: 'MetaRight',
    label: 'Win',
    width: 1.25
  },
  {
    code: 'ContextMenu',
    label: 'Menu',
    width: 1.25
  },
  {
    code: 'ControlRight',
    label: 'Ctrl',
    width: 1.25
  }
]

const MAIN_BLOCK = [FUNCTION_ROW, NUMBER_ROW, QWERTY_ROW, HOME_ROW, BOTTOM_ROW, SPACE_ROW]
const SYSTEM_ROW = [
  {
    code: 'PrintScreen',
    label: 'PrtScn'
  },
  {
    code: 'ScrollLock',
    label: 'ScrLk'
  },
  {
    code: 'Pause',
    label: 'Pause'
  }
]

const NAV_BLOCK = [
  SYSTEM_ROW,
  [
    {
      code: 'Insert',
      label: 'Ins'
    },
    {
      code: 'Home',
      label: 'Home'
    },
    {
      code: 'PageUp',
      label: 'PgUp'
    }
  ],
  [
    {
      code: 'Delete',
      label: 'Del'
    },
    {
      code: 'End',
      label: 'End'
    },
    {
      code: 'PageDown',
      label: 'PgDn'
    }
  ],
  [
    {
      code: '__g4',
      label: '',
      spacer: true
    },
    {
      code: 'ArrowUp',
      label: '↑'
    },
    {
      code: '__g5',
      label: '',
      spacer: true
    }
  ],
  [
    {
      code: 'ArrowLeft',
      label: '←'
    },
    {
      code: 'ArrowDown',
      label: '↓'
    },
    {
      code: 'ArrowRight',
      label: '→'
    }
  ]
]

const NUMPAD_BLOCK = [
  [
    {
      code: 'NumLock',
      label: 'Num'
    },
    {
      code: 'NumpadDivide',
      label: '/'
    },
    {
      code: 'NumpadMultiply',
      label: '*'
    },
    {
      code: 'NumpadSubtract',
      label: '-'
    }
  ],
  [
    {
      code: 'Numpad7',
      label: '7'
    },
    {
      code: 'Numpad8',
      label: '8'
    },
    {
      code: 'Numpad9',
      label: '9'
    },
    {
      code: 'NumpadAdd',
      label: '+'
    }
  ],
  [
    {
      code: 'Numpad4',
      label: '4'
    },
    {
      code: 'Numpad5',
      label: '5'
    },
    {
      code: 'Numpad6',
      label: '6'
    },
    {
      code: '__g6',
      label: '',
      spacer: true
    }
  ],
  [
    {
      code: 'Numpad1',
      label: '1'
    },
    {
      code: 'Numpad2',
      label: '2'
    },
    {
      code: 'Numpad3',
      label: '3'
    },
    {
      code: 'NumpadEnter',
      label: 'Enter'
    }
  ],
  [
    {
      code: 'Numpad0',
      label: '0',
      width: 2
    },
    {
      code: 'NumpadDecimal',
      label: '.'
    }
  ]
]

function KeyCap({ def, state }) {
  const width = (def.width ?? 1) * UNIT
  if (def.spacer) {
    return (
      <div
        style={{
          width: `${width}rem`,
          height: `${UNIT}rem`
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: `${width}rem`,
        height: `${UNIT}rem`
      }}
      className={cn(
        'flex select-none items-center justify-center rounded-md border text-[11px] font-medium transition-colors duration-150',
        state === 'idle' && 'border-zinc-700 bg-zinc-900 text-zinc-300',
        state === 'pressed' && 'scale-95 border-blue-600 bg-blue-600 text-white shadow-sm',
        state === 'tested' && 'border-emerald-600 bg-emerald-600 text-white'
      )}
    >
      {def.label}
    </div>
  )
}

function KeyRow({ row, keyStates }) {
  return (
    <div className="flex gap-1">
      {row.map((def) => (
        <KeyCap key={def.code} def={def} state={keyStates[def.code] ?? 'idle'} />
      ))}
    </div>
  )
}

const MOUSE_BUTTON_BY_CODE = {
  0: 'left',
  1: 'middle',
  2: 'right',
  3: 'back',
  4: 'forward'
}

const MOUSE_BUTTON_ORDER = ['left', 'middle', 'right', 'back', 'forward']
const MOUSE_BUTTON_LABELS = {
  left: 'Left',
  middle: 'Middle',
  right: 'Right',
  back: 'Back',
  forward: 'Forward'
}

function emptyMouseButtonState() {
  return {
    left: false,
    middle: false,
    right: false,
    back: false,
    forward: false
  }
}

function emptyMouseClickCounts() {
  return {
    left: 0,
    middle: 0,
    right: 0,
    back: 0,
    forward: 0
  }
}

export function KeyboardModule() {
  const [keyStates, setKeyStates] = useState({})
  const containerRef = useRef(null)
  const contentRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [scaledHeight, setScaledHeight] = useState(null)
  const [fullCaptureActive, setFullCaptureActive] = useState(false)
  const [captureError, setCaptureError] = useState(null)
  const fullCaptureActiveRef = useRef(false)
  const lastSeenRef = useRef({})
  const [mousePressed, setMousePressed] = useState(emptyMouseButtonState)
  const [mouseClickCounts, setMouseClickCounts] = useState(emptyMouseClickCounts)
  const allCodes = useMemo(() => {
    const codes = new Set()
    for (const block of [MAIN_BLOCK, NAV_BLOCK, NUMPAD_BLOCK]) {
      for (const row of block) {
        for (const def of row) {
          if (!def.spacer) codes.add(def.code)
        }
      }
    }
    return codes
  }, [])
  const testedCount = useMemo(
    () => Object.values(keyStates).filter((s) => s === 'tested').length,
    [keyStates]
  )
  const reset = useCallback(() => {
    setKeyStates({})
    setMousePressed(emptyMouseButtonState())
    setMouseClickCounts(emptyMouseClickCounts())
  }, [])
  const enableFullCapture = useCallback(async () => {
    setCaptureError(null)
    try {
      await window.api.setFullscreen(true)
      await document.documentElement.requestFullscreen()
      const nav = navigator
      if (nav.keyboard?.lock) {
        await nav.keyboard.lock(['MetaLeft', 'MetaRight'])
      }
      setFullCaptureActive(true)
    } catch {
      setCaptureError(
        "Couldn't enable full capture — the Windows key may still open the Start menu."
      )
      if (document.fullscreenElement) void document.exitFullscreen()
      void window.api.setFullscreen(false)
      setFullCaptureActive(false)
    }
  }, [])
  const disableFullCapture = useCallback(() => {
    const nav = navigator
    nav.keyboard?.unlock?.()
    if (document.fullscreenElement) void document.exitFullscreen()
    void window.api.setFullscreen(false)
    setFullCaptureActive(false)
  }, [])
  useEffect(() => {
    fullCaptureActiveRef.current = fullCaptureActive
  }, [fullCaptureActive])
  useEffect(() => {
    if (!fullCaptureActive) return
    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        void window.api.setFullscreen(false)
        setFullCaptureActive(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [fullCaptureActive])
  useEffect(() => {
    return () => {
      if (!fullCaptureActiveRef.current) return
      const nav = navigator
      nav.keyboard?.unlock?.()
      if (document.fullscreenElement) void document.exitFullscreen()
      void window.api.setFullscreen(false)
    }
  }, [])
  useEffect(() => {
    void window.api.setKeyboardCaptureActive(true)
    const unsubscribe = window.api.onKeyInputEvent((event) => {
      if (!allCodes.has(event.code)) return
      if (event.type === 'keyDown') {
        lastSeenRef.current[event.code] = Date.now()
        if (event.isAutoRepeat) return
        if (event.code === 'CapsLock' || event.code === 'NumLock') {
          void window.api.revertLockKeyToggle(event.code)
        }
        setKeyStates((prev) =>
          prev[event.code] === 'pressed'
            ? prev
            : {
                ...prev,
                [event.code]: 'pressed'
              }
        )
      } else {
        setKeyStates((prev) => ({
          ...prev,
          [event.code]: 'tested'
        }))
      }
    })
    return () => {
      void window.api.setKeyboardCaptureActive(false)
      unsubscribe()
    }
  }, [allCodes])
  useEffect(() => {
    function handleWindowBlur() {
      setKeyStates((prev) => {
        let changed = false
        const next = {
          ...prev
        }
        for (const code in next) {
          if (next[code] === 'pressed') {
            next[code] = 'tested'
            changed = true
          }
        }
        return changed ? next : prev
      })
      setMousePressed((prev) => {
        const anyHeld = MOUSE_BUTTON_ORDER.some((id) => prev[id])
        return anyHeld ? emptyMouseButtonState() : prev
      })
    }
    window.addEventListener('blur', handleWindowBlur)
    return () => window.removeEventListener('blur', handleWindowBlur)
  }, [])
  useEffect(() => {
    const STALE_MS = 400
    const CHECK_INTERVAL_MS = 80
    const interval = setInterval(() => {
      const now = Date.now()
      setKeyStates((prev) => {
        let changed = false
        const next = {
          ...prev
        }
        for (const code in next) {
          if (next[code] !== 'pressed') continue
          const lastSeen = lastSeenRef.current[code] ?? 0
          if (now - lastSeen > STALE_MS) {
            next[code] = 'tested'
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    function handleEscapeDown(e) {
      if (e.code !== 'Escape' || e.repeat) return
      setKeyStates((prev) =>
        prev.Escape === 'pressed'
          ? prev
          : {
              ...prev,
              Escape: 'pressed'
            }
      )
    }
    function handleEscapeUp(e) {
      if (e.code !== 'Escape') return
      setKeyStates((prev) => ({
        ...prev,
        Escape: 'tested'
      }))
    }
    window.addEventListener('keydown', handleEscapeDown)
    window.addEventListener('keyup', handleEscapeUp)
    return () => {
      window.removeEventListener('keydown', handleEscapeDown)
      window.removeEventListener('keyup', handleEscapeUp)
    }
  }, [])
  useEffect(() => {
    void window.api.setPrintScreenBlocked(true)
    const unsubscribe = window.api.onPrintScreenPressed(() => {
      setKeyStates((prev) => ({
        ...prev,
        PrintScreen: 'pressed'
      }))
      window.setTimeout(() => {
        setKeyStates((prev) => ({
          ...prev,
          PrintScreen: 'tested'
        }))
      }, 150)
    })
    return () => {
      void window.api.setPrintScreenBlocked(false)
      unsubscribe()
    }
  }, [])
  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return
    const recompute = () => {
      const containerWidth = container.clientWidth
      const naturalWidth = content.offsetWidth
      const nextScale = naturalWidth > 0 ? Math.min(1, containerWidth / naturalWidth) : 1
      setScale(nextScale)
      setScaledHeight(content.offsetHeight * nextScale)
    }
    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    function handlePointerDown(e) {
      if (e.pointerType !== 'mouse') return
      const id = MOUSE_BUTTON_BY_CODE[e.button]
      if (!id) return
      setMousePressed((prev) => ({
        ...prev,
        [id]: true
      }))
      setMouseClickCounts((prev) => ({
        ...prev,
        [id]: prev[id] + 1
      }))
    }
    function handlePointerUp(e) {
      if (e.pointerType !== 'mouse') return
      const id = MOUSE_BUTTON_BY_CODE[e.button]
      if (!id) return
      setMousePressed((prev) => ({
        ...prev,
        [id]: false
      }))
    }
    function handleContextMenu(e) {
      e.preventDefault()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('contextmenu', handleContextMenu)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])
  return (
    <div
      className={cn(fullCaptureActive && 'fixed inset-0 z-50 overflow-y-auto bg-background p-8')}
    >
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{'Keyboard & mouse test'}</h1>
          <p className="text-sm text-zinc-500">
            Press each key on your physical keyboard and use the mouse or trackpad below — key
            detection is based on physical position (key code), not character, so it works
            regardless of the configured language.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {fullCaptureActive ? (
            <Button variant="outline" onClick={disableFullCapture} className="gap-2">
              <Shrink className="h-4 w-4" />
              Exit full capture (Esc)
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void enableFullCapture()} className="gap-2">
              <Maximize className="h-4 w-4" />
              Enable full capture
            </Button>
          )}
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset test
          </Button>
        </div>
      </header>
      {captureError && (
        <Card className="mb-4 border-amber-900/50 bg-amber-950/40">
          <CardContent className="py-3 text-sm text-amber-400">{captureError}</CardContent>
        </Card>
      )}
      {!fullCaptureActive && (
        <p className="mb-4 -mt-4 text-xs text-zinc-400">
          {
            '"Enable full capture" switches to full screen so the Windows key can also be captured without opening the Start menu (Caps Lock and Num Lock are always corrected, and Print Screen is always blocked, even without full capture).'
          }
        </p>
      )}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center gap-2">
          <Keyboard className="h-5 w-5 text-zinc-400" />
          <div className="flex-1">
            <CardTitle>Keyboard progress</CardTitle>
            <CardDescription>
              {testedCount}
              {' / '}
              {allCodes.size}
              {' keys tested'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-zinc-700 bg-zinc-900" />
              {' Untested'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-blue-600 bg-blue-600" />
              {' Pressed'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-emerald-600 bg-emerald-600" />
              {' Tested'}
            </span>
          </div>
        </CardHeader>
      </Card>
      <Card className="mb-4">
        <CardContent className="overflow-hidden py-6">
          <div
            ref={containerRef}
            className="w-full"
            style={{
              height: scaledHeight ?? void 0
            }}
          >
            <div
              ref={contentRef}
              className="flex w-fit items-start gap-4"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left'
              }}
            >
              <div className="flex flex-col gap-1">
                {MAIN_BLOCK.map((row, i) => (
                  <KeyRow key={i} row={row} keyStates={keyStates} />
                ))}
              </div>
              <div className="flex flex-col gap-1">
                {NAV_BLOCK.map((row, i) => (
                  <KeyRow key={i} row={row} keyStates={keyStates} />
                ))}
              </div>
              <div className="flex flex-col gap-1 pt-11">
                {NUMPAD_BLOCK.map((row, i) => (
                  <KeyRow key={i} row={row} keyStates={keyStates} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Mouse className="h-5 w-5 text-zinc-400" />
          <div>
            <CardTitle>Mouse</CardTitle>
            <CardDescription>
              {
                "Click each button — left, middle, right, and the side back/forward buttons if your mouse has them — anywhere on the window. The matching part of the mouse below lights up as you press it, and each button's click count is shown underneath."
              }
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-5">
          <div className="relative h-64 w-36 drop-shadow-lg">
            <div className="absolute left-1 top-28 z-0 flex flex-col gap-2.5">
              <div
                title="Back"
                className={cn(
                  'h-6 w-4 rounded-l-md border border-r-0 border-zinc-700 bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-sm transition-colors duration-150',
                  mousePressed.back &&
                    'border-emerald-600 bg-gradient-to-b from-emerald-500 to-emerald-500'
                )}
              />
              <div
                title="Forward"
                className={cn(
                  'h-6 w-4 rounded-l-md border border-r-0 border-zinc-700 bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-sm transition-colors duration-150',
                  mousePressed.forward &&
                    'border-emerald-600 bg-gradient-to-b from-emerald-500 to-emerald-500'
                )}
              />
            </div>
            <div className="absolute inset-0 z-10 overflow-hidden rounded-t-full rounded-b-[42%] border border-zinc-700 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900">
              <div
                className={cn(
                  'absolute left-0 top-0 h-28 w-1/2 transition-colors duration-150',
                  mousePressed.left && 'bg-emerald-500'
                )}
              />
              <div
                className={cn(
                  'absolute right-0 top-0 h-28 w-1/2 transition-colors duration-150',
                  mousePressed.right && 'bg-emerald-500'
                )}
              />
              <div className="absolute left-1/2 top-0 h-28 w-px -translate-x-1/2 bg-zinc-300/70" />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-zinc-300/40" />
            </div>
            <div
              className={cn(
                'absolute left-1/2 top-3 z-20 h-12 w-4 -translate-x-1/2 rounded-full border border-zinc-400/70 bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-200 shadow-inner transition-colors duration-150',
                mousePressed.middle &&
                  'border-emerald-600 bg-gradient-to-b from-emerald-500 via-emerald-500 to-emerald-500'
              )}
            >
              <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-zinc-500/50" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {MOUSE_BUTTON_ORDER.map((id) => (
              <span
                key={id}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors',
                  mousePressed[id]
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                )}
              >
                {MOUSE_BUTTON_LABELS[id]}
                {' · '}
                {mouseClickCounts[id]}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
