import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { useI18n } from '../i18n'

/** The page's moving picture: a Toughbook at work, settling into frame as it scrolls past. */
export function FieldPhoto() {
  const { t } = useI18n()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const scale = useTransform(scrollYProgress, [0, 1], [1.18, 1])
  const y = useTransform(scrollYProgress, [0, 1], ['-6%', '6%'])

  return (
    <figure ref={ref} className="relative m-0">
      <div className="h-[56svh] overflow-hidden sm:h-[78svh]">
        <motion.img
          src="./photos/toughbook-cf19-open.jpg"
          alt="A Panasonic Toughbook CF-19 open on a work table outdoors, next to a photovoltaic curve tracer, clamps and a screwdriver."
          width="1920"
          height="1440"
          loading="lazy"
          style={{ scale, y }}
          className="size-full object-cover"
        />
      </div>
      <figcaption className="frame flex flex-col gap-1 pt-4 text-[15px] sm:flex-row sm:justify-between sm:gap-8">
        <span>{t('field.caption')}</span>
        <span className="text-muted sm:text-right">{t('field.credit')}</span>
      </figcaption>
    </figure>
  )
}
