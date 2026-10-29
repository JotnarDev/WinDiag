import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowResetRegular, CursorClickRegular, KeyboardRegular } from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card, Section } from '@/components/ui/Card'
import { InfoBar, ProgressBar, ProgressRing } from '@/components/ui/feedback'
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

const ALL_CODES = new Set(
  [MAIN_BLOCK, NAV_BLOCK, NUMPAD_BLOCK].flatMap((block) =>
    block.flatMap((row) => row.filter((def) => !def.spacer).map((def) => def.code))
  )
)

// Memoized so a key press only re-renders the key that changed
const KeyCap = memo(function KeyCap({ def, state }) {
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
        'flex items-center justify-center rounded-control border text-caption transition-[background-color,color,transform] duration-100',
        state === 'idle' &&
          'border-control-stroke bg-control text-text-primary shadow-[inset_0_-1px_0_var(--control-stroke-bottom)]',
        state === 'pressed' && 'scale-95 border-transparent bg-accent-fill text-text-on-accent',
        state === 'tested' && 'border-transparent bg-success-bg font-semibold text-success'
      )}
    >
      {def.label}
    </div>
  )
})

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

export function KeyboardModule({ onNavigate }) {
  const [keyStates, setKeyStates] = useState({})
  const containerRef = useRef(null)
  const contentRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [scaledHeight, setScaledHeight] = useState(null)
  // null while the hook starts, then whether system keys are intercepted
  // (or 'off' when that's turned off in Settings)
  const [systemKeysBlocked, setSystemKeysBlocked] = useState(null)
  const lastSeenRef = useRef({})
  const [mousePressed, setMousePressed] = useState(emptyMouseButtonState)
  const [mouseClickCounts, setMouseClickCounts] = useState(emptyMouseClickCounts)
  const testedCount = useMemo(
    () => Object.values(keyStates).filter((s) => s === 'tested').length,
    [keyStates]
  )
  const reset = useCallback(() => {
    setKeyStates({})
    setMousePressed(emptyMouseButtonState())
    setMouseClickCounts(emptyMouseClickCounts())
  }, [])
  useEffect(() => {
    let cancelled = false
    const unsubscribe = window.api.onKeyInputEvent((event) => {
      if (!ALL_CODES.has(event.code)) return
      if (event.type === 'keyDown') {
        lastSeenRef.current[event.code] = Date.now()
        if (event.isAutoRepeat) return
        setKeyStates((prev) =>
          prev[event.code] === 'pressed'
            ? prev
            : {
                ...prev,
                [event.code]: 'pressed'
              }
        )
      } else {
        setKeyStates((prev) =>
          prev[event.code] === 'tested'
            ? prev
            : {
                ...prev,
                [event.code]: 'tested'
              }
        )
      }
    })
    window.api
      .setKeyboardCaptureActive(true)
      .then((blocked) => {
        if (!cancelled) setSystemKeysBlocked(blocked === 'off' ? 'off' : Boolean(blocked))
      })
      .catch(() => {
        if (!cancelled) setSystemKeysBlocked(false)
      })
    return () => {
      cancelled = true
      void window.api.setKeyboardCaptureActive(false)
      unsubscribe()
    }
  }, [])
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
  const hasPressedKey = useMemo(() => Object.values(keyStates).includes('pressed'), [keyStates])
  // Without the hook, Windows sometimes eats a key-up (e.g. the Windows key),
  // so a key that stops auto-repeating is released by timeout. The hook
  // reports every key-up, so this only runs as a fallback while a key is held.
  useEffect(() => {
    if (!hasPressedKey || systemKeysBlocked === true) return
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
  }, [hasPressedKey, systemKeysBlocked])
  // Fallback for Print Screen when the hook isn't running: Windows only
  // reports it as a hotkey, so there's no real key-up
  useEffect(() => {
    if (systemKeysBlocked !== false) return
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
  }, [systemKeysBlocked])
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
  const progress = (testedCount / ALL_CODES.size) * 100
  const mouseButtonClass = (pressed) =>
    cn('transition-colors duration-100', pressed && 'bg-accent-fill')
  return (
    <Page
      title="Keyboard & mouse"
      description="Press every key and click every mouse button. Keys are matched by physical position, so any keyboard language works."
      actions={
        <Button icon={ArrowResetRegular} onClick={reset}>
          Reset
        </Button>
      }
    >
      {systemKeysBlocked === null && (
        <Card className="mb-3 flex items-center gap-3 px-4 py-3 text-text-secondary">
          <ProgressRing size={16} label="Preparing" />
          Intercepting system keys…
        </Card>
      )}
      {systemKeysBlocked === true && (
        <InfoBar severity="info" className="mb-3">
          While this window is in front, system keys (Windows, Print Screen, Esc, Alt+Tab and the
          lock keys) light up here but don&apos;t act. Use the mouse to leave this page.
        </InfoBar>
      )}
      {systemKeysBlocked === 'off' && (
        <InfoBar
          severity="info"
          className="mb-3"
          action={<Button onClick={() => onNavigate('settings')}>Settings</Button>}
        >
          Blocking system keys is turned off, so keys like Windows and Print Screen act normally
          during the test.
        </InfoBar>
      )}
      {systemKeysBlocked === false && (
        <InfoBar severity="warning" title="Couldn't intercept system keys." className="mb-3">
          The Windows key may open Start and shortcuts like Alt+Tab still work. Lock keys are
          switched back after each press.
        </InfoBar>
      )}

      <Section title="Keyboard">
        <Card className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <KeyboardRegular aria-hidden className="size-5 shrink-0" />
            <div className="min-w-48 flex-1">
              <p>
                <span className="font-semibold">{testedCount}</span>
                <span className="text-text-secondary"> of {ALL_CODES.size} keys tested</span>
              </p>
              <ProgressBar
                label="Keys tested"
                value={progress}
                tone={testedCount === ALL_CODES.size ? 'success' : 'accent'}
                className="mt-2 max-w-md"
              />
            </div>
            <div className="flex items-center gap-4 text-caption text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[2px] border border-control-strong bg-control" />
                Not tested
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[2px] bg-accent-fill" />
                Pressed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[2px] bg-success" />
                Tested
              </span>
            </div>
          </div>
          <div
            ref={containerRef}
            className="w-full overflow-hidden"
            style={{ height: scaledHeight ?? undefined }}
          >
            <div
              ref={contentRef}
              className="flex w-fit items-start gap-4"
              style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
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
        </Card>
      </Section>

      <Section title="Mouse">
        <Card className="flex flex-wrap items-center gap-8 p-5">
          <div className="relative h-56 w-32 shrink-0" aria-hidden>
            <div className="absolute top-24 left-0 z-0 flex flex-col gap-2">
              {['back', 'forward'].map((id) => (
                <div
                  key={id}
                  className={cn(
                    'h-6 w-3 rounded-l-control border border-r-0 border-control-strong bg-control',
                    mousePressed[id] && 'border-transparent bg-accent-fill'
                  )}
                />
              ))}
            </div>
            <div className="absolute inset-y-0 right-0 left-2 z-10 overflow-hidden rounded-t-full rounded-b-[42%] border border-control-strong bg-control">
              <div
                className={cn(
                  'absolute top-0 left-0 h-24 w-1/2',
                  mouseButtonClass(mousePressed.left)
                )}
              />
              <div
                className={cn(
                  'absolute top-0 right-0 h-24 w-1/2',
                  mouseButtonClass(mousePressed.right)
                )}
              />
              <div className="absolute top-0 left-1/2 h-24 w-px -translate-x-1/2 bg-control-strong" />
              <div className="absolute inset-x-0 top-24 h-px bg-control-strong" />
            </div>
            <div
              className={cn(
                'absolute top-4 left-[calc(50%+4px)] z-20 h-10 w-3.5 -translate-x-1/2 rounded-full border border-control-strong bg-solid-bg',
                mousePressed.middle && 'border-transparent bg-accent-fill'
              )}
            />
          </div>
          <div className="flex min-w-56 flex-1 flex-col gap-3">
            <div className="flex items-start gap-3">
              <CursorClickRegular aria-hidden className="mt-0.5 size-5 shrink-0" />
              <p className="text-text-secondary">
                Click each button anywhere in the window: left, middle (wheel), right, and the side
                back/forward buttons if the mouse has them.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2" aria-label="Mouse buttons">
              {MOUSE_BUTTON_ORDER.map((id) => (
                <li
                  key={id}
                  className={cn(
                    'flex items-center justify-between rounded-control border border-control-stroke px-3 py-1.5 transition-colors',
                    mousePressed[id]
                      ? 'border-transparent bg-accent-fill text-text-on-accent'
                      : mouseClickCounts[id] > 0
                        ? 'border-transparent bg-success-bg text-success'
                        : 'bg-control'
                  )}
                >
                  <span>{MOUSE_BUTTON_LABELS[id]}</span>
                  <span className="text-caption">
                    {mouseClickCounts[id]} {mouseClickCounts[id] === 1 ? 'click' : 'clicks'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </Section>
    </Page>
  )
}
