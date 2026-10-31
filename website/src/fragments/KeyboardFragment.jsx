import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Battery6Regular,
  CheckmarkCircle16Filled,
  DesktopRegular,
  HardDriveRegular,
  HomeRegular,
  KeyboardMouseRegular,
  TapSingleRegular
} from '@fluentui/react-icons'
import { useI18n } from '../i18n'
import { cn } from '../lib/cn'
import { EASE } from '../lib/motion'
import { ProgressBar, UiButton } from './ui'

// A laptop keyboard, matched by physical key (KeyboardEvent.code) like the
// app's own test, so it works with any layout. [code, label, width in units]
const ROWS = [
  [['Escape', 'Esc', 1.25], ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], ['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8'], ['F9', 'F9'], ['F10', 'F10'], ['F11', 'F11'], ['F12', 'F12'], ['Delete', 'Del', 1.75]],
  [['Backquote', '`'], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'], ['Minus', '-'], ['Equal', '='], ['Backspace', 'Backspace', 2]],
  [['Tab', 'Tab', 1.5], ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'], ['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'], ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\', 1.5]],
  [['CapsLock', 'Caps', 1.75], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', ';'], ['Quote', "'"], ['Enter', 'Enter', 2.25]],
  [['ShiftLeft', 'Shift', 2.25], ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'], ['KeyB', 'B'], ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', ','], ['Period', '.'], ['Slash', '/'], ['ShiftRight', 'Shift', 2.75]],
  [['ControlLeft', 'Ctrl', 1.25], ['MetaLeft', 'Win', 1.25], ['AltLeft', 'Alt', 1.25], ['Space', '', 5.5], ['AltRight', 'Alt', 1.25], ['ControlRight', 'Ctrl', 1.25], ['ArrowLeft', '←'], ['ArrowUp', '↑'], ['ArrowDown', '↓'], ['ArrowRight', '→']]
]

const ALL_CODES = ROWS.flat().map(([code]) => code)
const LABELS = Object.fromEntries(ROWS.flat().map(([code, label]) => [code, label || 'Space']))
// Keys that would scroll the page while the visitor is testing the keyboard
const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'])

const NAV = [
  { id: 'overview', icon: HomeRegular },
  { id: 'display', icon: DesktopRegular },
  { id: 'touch', icon: TapSingleRegular },
  { id: 'keyboard', icon: KeyboardMouseRegular },
  { id: 'battery', icon: Battery6Regular },
  { id: 'disk', icon: HardDriveRegular }
]

function Key({ code, label, width = 1, state, onPress }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={LABELS[code]}
      onPointerDown={() => onPress(code)}
      style={{ flexGrow: width, flexBasis: 0 }}
      className={cn(
        'relative flex h-[var(--key-h)] min-w-0 items-center justify-center rounded-[4px] border text-[clamp(9px,1.9cqw,13px)] leading-none transition-[background-color,border-color,color,transform] duration-200',
        state === 'down' && 'scale-[0.94]',
        state === 'tested' || state === 'down'
          ? 'border-transparent bg-accent text-on-accent'
          : 'border-control-stroke bg-control text-ui-text-2 hover:bg-control-hover'
      )}
    >
      <span className="truncate px-0.5">{label}</span>
    </button>
  )
}

/**
 * The hero's live fragment: WinDiag's keyboard test, working on the visitor's
 * own keyboard. Keys light up as they are pressed (or tapped on a phone).
 */
export function KeyboardFragment({ armed }) {
  const { t } = useI18n()
  const [tested, setTested] = useState(() => new Set())
  const [down, setDown] = useState(() => new Set())
  const [last, setLast] = useState(null)
  const armedRef = useRef(armed)
  armedRef.current = armed

  const press = useCallback((code) => {
    setTested((prev) => (prev.has(code) ? prev : new Set(prev).add(code)))
    setLast(code)
  }, [])

  useEffect(() => {
    const onDown = (event) => {
      if (!ALL_CODES.includes(event.code)) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]')) return
      if (armedRef.current && SCROLL_KEYS.has(event.code) && !event.altKey && !event.ctrlKey) event.preventDefault()
      press(event.code)
      setDown((prev) => new Set(prev).add(event.code))
    }
    const onUp = (event) =>
      setDown((prev) => {
        if (!prev.has(event.code)) return prev
        const next = new Set(prev)
        next.delete(event.code)
        return next
      })
    const clear = () => setDown(new Set())
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [press])

  const total = ALL_CODES.length
  const done = tested.size
  const complete = done === total
  const reset = () => {
    setTested(new Set())
    setLast(null)
  }

  return (
    // A Windows 11 window casts its own shadow: this is the app's window, not page decoration
    <div
      data-ui
      className="w-full max-w-[680px] overflow-hidden rounded-[8px] border border-card-stroke bg-bg shadow-[0_32px_64px_rgb(0_0_0/0.14),0_2px_21px_rgb(0_0_0/0.1)] dark:shadow-[0_32px_64px_rgb(0_0_0/0.5),0_2px_21px_rgb(0_0_0/0.4)]" /* taste-skill-ignore */
    >
      {/* Title bar */}
      <div className="flex h-10 items-center gap-3 px-4">
        <img src="./app-icon.png" alt="" width="16" height="16" className="size-4" />
        <span className="text-[12px]">{t('keyboard.window')}</span>
        <span className="ml-auto flex items-center gap-5 text-ui-text-2" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" /></svg>
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" rx="1.5" /></svg>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" /></svg>
        </span>
      </div>

      <div className="flex">
        {/* Navigation pane, cropped to its icons below 560px */}
        <nav aria-hidden="true" className="hidden w-[188px] shrink-0 flex-col gap-1 px-1.5 pb-3 sm:flex">
          {NAV.map(({ id, icon: Icon }) => (
            <span
              key={id}
              className={cn(
                'relative flex h-9 items-center gap-3 rounded-[4px] px-3 text-[13px]',
                id === 'keyboard' ? 'bg-subtle-hover' : 'text-ui-text-2'
              )}
            >
              {id === 'keyboard' && <span className="absolute left-0 h-4 w-[3px] rounded-full bg-accent" />}
              <Icon fontSize={16} />
              <span className="truncate">{t(`keyboard.nav.${id}`)}</span>
            </span>
          ))}
        </nav>

        {/* Page: WinUI's content layer has a 1px stroke on its top-left edge */}
        <div className="min-w-0 flex-1 rounded-tl-[8px] border-l border-t border-card-stroke bg-raise p-4 sm:p-5" /* taste-skill-ignore */>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-[20px] font-semibold tracking-normal">{t('keyboard.page')}</h3>
            <UiButton onClick={reset} disabled={done === 0}>
              {t('keyboard.reset')}
            </UiButton>
          </div>

          <div className="@container rounded-[8px] border border-card-stroke bg-card p-2.5 [--key-h:clamp(22px,6.4cqw,36px)]">
            <div className="flex flex-col gap-[clamp(3px,0.8cqw,5px)]">
              {ROWS.map((row, i) => (
                <div key={i} className="flex gap-[clamp(3px,0.8cqw,5px)]">
                  {row.map(([code, label, width]) => (
                    <Key
                      key={code}
                      code={code}
                      label={label}
                      width={width}
                      onPress={press}
                      state={down.has(code) ? 'down' : tested.has(code) ? 'tested' : 'idle'}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-[8px] border border-card-stroke bg-card px-4 py-3">
            <div>
              <div className="text-[12px] text-ui-text-2">{t('keyboard.tested')}</div>
              <div className="tabular text-[15px] font-semibold">{t('keyboard.of', { done, total })}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[12px] text-ui-text-2">{t('keyboard.last')}</div>
              <div className="relative h-5 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={last ?? 'none'}
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -16, opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="truncate text-[15px] font-semibold"
                  >
                    {last ? `${LABELS[last]} · ${last}` : t('keyboard.none')}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <div className="col-span-2">
              <ProgressBar value={done / total} />
            </div>
            <AnimatePresence>
              {complete && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="col-span-2 flex items-center gap-2 overflow-hidden rounded-[4px] bg-success-bg px-3 py-2 text-[14px]"
                >
                  <CheckmarkCircle16Filled className="text-success" />
                  {t('keyboard.done')}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
