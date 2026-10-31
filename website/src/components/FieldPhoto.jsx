import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { useI18n } from '../i18n'
import { OverviewFragment } from '../fragments/OverviewFragment'

/** The page's big picture: WinDiag's Overview window on a desktop, settling into frame as it scrolls past. */
export function FieldPhoto() {
  const { t } = useI18n()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1])
  const y = useTransform(scrollYProgress, [0, 1], ['8%', '0%'])

  return (
    <figure ref={ref} className="relative m-0">
      <div className="overflow-hidden bg-[var(--band-windows)] px-[var(--gutter)] py-[clamp(32px,6vw,88px)] transition-colors duration-500">
        <motion.div style={{ scale, y }} className="mx-auto max-w-[1120px]">
          <OverviewFragment />
        </motion.div>
      </div>
      <figcaption className="frame flex flex-col gap-1 pt-4 text-[15px] sm:flex-row sm:justify-between sm:gap-8">
        <span>{t('field.caption')}</span>
        <span className="shrink-0 text-muted sm:text-right">{t('field.sample')}</span>
      </figcaption>
    </figure>
  )
}
