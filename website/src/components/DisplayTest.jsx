import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '../i18n'

// The same solid fills the app's Display test steps through
const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000']

/** WinDiag's display test on the visitor's own screen: full-screen solid colours. */
export function DisplayTest({ open, onClose }) {
  const { t } = useI18n()
  const ref = useRef(null)
  const [index, setIndex] = useState(0)
  const [hint, setHint] = useState(true)

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    setIndex(0)
    setHint(true)
    ref.current?.focus()
    ref.current?.requestFullscreen?.().catch(() => {})
    const timer = setTimeout(() => setHint(false), 2600)
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' || e.key === ' ') setIndex((i) => (i + 1) % COLORS.length)
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + COLORS.length) % COLORS.length)
      else return
      e.preventDefault()
    }
    const onFullscreen = () => {
      if (!document.fullscreenElement) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [open, close, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Display test"
          className="fixed inset-0 z-50 cursor-none outline-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, backgroundColor: COLORS[index] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          /* Tapping steps through the colours and leaves after the last one (phones have no Esc) */
          onClick={() => (index === COLORS.length - 1 ? close() : setIndex(index + 1))}
        >
          <AnimatePresence>
            {hint && (
              <motion.p
                className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-[4px] bg-black/75 px-4 py-2 text-[15px] text-white"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {t('board.displayHint')}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
