import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useCopy } from '../copy'
import { OverviewFragment, WINDOW_SIZE } from '../fragments/OverviewFragment'

// Below this scale the window is a picture: too small to tap, so it ignores touches
const TAP_SCALE = 0.6

/** Scales the fixed-size window to the width of the laptop's screen. */
function useFitScale(ref) {
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    const update = () => setScale(el.clientWidth / WINDOW_SIZE.width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return scale
}

/**
 * The page's big picture: a laptop whose lid opens as it scrolls into view.
 * The screen wakes, WinDiag reads the components, and its Overview fills in.
 */
export function FieldPhoto() {
  const { t } = useCopy()
  const ref = useRef(null)
  const screenRef = useRef(null)
  const reduced = useReducedMotion()
  const scale = useFitScale(screenRef)

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const rotateX = useTransform(scrollYProgress, [0.1, 0.75], reduced ? [0, 0] : [-82, 0])
  const lift = useTransform(scrollYProgress, [0.1, 0.75], reduced ? ['0%', '0%'] : ['6%', '0%'])

  // The screen wakes once the lid is nearly open, and stays awake
  const awake = useInView(screenRef, { amount: 0.6, once: true })
  const [phase, setPhase] = useState(reduced ? 'ready' : 'off')
  useEffect(() => {
    if (awake) setPhase((p) => (p === 'off' ? 'reading' : p))
  }, [awake])
  useEffect(() => {
    if (phase !== 'reading') return
    const id = setTimeout(() => setPhase('ready'), 1300)
    return () => clearTimeout(id)
  }, [phase])

  return (
    <figure ref={ref} className="relative m-0">
      <div className="overflow-hidden bg-accent px-[var(--gutter)] pb-[clamp(40px,7vw,104px)] pt-[clamp(32px,6vw,88px)] transition-colors duration-500">
        <motion.div style={{ y: lift }} className="mx-auto max-w-[1180px] [perspective:2000px]">
          {/* Lid: dark bezel around the screen, hinged on its bottom edge */}
          <motion.div
            style={{ rotateX, transformOrigin: '50% 100%' }}
            className="relative mx-auto w-[88%] rounded-t-[clamp(8px,1.6vw,20px)] bg-[#17191c] p-[1.4%] pb-[2.2%] shadow-[0_0_0_1px_rgb(255_255_255/0.06)_inset]" /* taste-skill-ignore */
          >
            <span className="absolute left-1/2 top-[0.55%] size-[clamp(3px,0.45vw,6px)] -translate-x-1/2 rounded-full bg-[#2c3036]" aria-hidden="true" />
            <div
              ref={screenRef}
              className={`relative aspect-[16/10] overflow-hidden bg-black ${scale < TAP_SCALE ? 'pointer-events-none' : ''}`}
            >
              {/* Asleep until the lid opens: the window fades in on a black screen */}
              <motion.div
                initial={false}
                animate={{ opacity: phase === 'off' ? 0 : 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>
                  <OverviewFragment phase={phase} interactive={scale >= TAP_SCALE} />
                </div>
              </motion.div>
            </div>
          </motion.div>
          {/* Base: the deck's front edge with its thumb notch */}
          <div
            className="relative h-[clamp(10px,1.7vw,22px)] rounded-b-[clamp(8px,1.4vw,18px)] rounded-t-[2px] bg-[#c4c8cd]"
            aria-hidden="true"
          >
            <span className="absolute left-1/2 top-0 h-[38%] w-[14%] -translate-x-1/2 rounded-b-[8px] bg-[#9ea3a9]" />
            <span className="absolute inset-x-0 bottom-0 h-[34%] rounded-b-[inherit] bg-[#9ea3a9]" />
          </div>
        </motion.div>
      </div>
      <figcaption className="frame flex flex-col gap-1 pt-4 text-[15px] sm:flex-row sm:justify-between sm:gap-8">
        <span>{t('field.caption')}</span>
        <span className="shrink-0 text-muted sm:text-right">{t('field.sample')}</span>
      </figcaption>
    </figure>
  )
}
