import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDownloadRegular, KeyboardRegular } from '@fluentui/react-icons'
import { useI18n } from '../i18n'
import { SITE } from '../lib/site'
import { EASE } from '../lib/motion'
import { KeyboardFragment } from '../fragments/KeyboardFragment'
import { Button } from './Button'

const touchFirst = () => window.matchMedia('(hover: none)').matches

/**
 * First screen in two tones: the claim on the page ground, and on the half
 * one step lighter, WinDiag's keyboard test reading the visitor's keyboard.
 */
export function Hero() {
  const { t } = useI18n()
  const ref = useRef(null)
  const [armed, setArmed] = useState(false)
  const [touch] = useState(touchFirst)
  const lines = t('hero.lines')

  // The keyboard test only holds the scroll keys while the hero is on screen
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setArmed(entry.intersectionRatio > 0.6), {
      threshold: [0, 0.6, 1]
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="top" ref={ref} className="grid lg:min-h-[calc(100svh-64px)] lg:grid-cols-2">
      <div className="flex flex-col justify-end px-[var(--gutter)] pb-10 pt-12 lg:pb-20 lg:pr-12">
        <h1 className="text-h1 font-semibold">
          {lines.map((line, i) => (
            <span key={i} className="mask-line">
              <motion.span
                className="block"
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.11 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
        >
          <p className="mt-8 max-w-[44ch] text-[18px] leading-[1.55] sm:text-[20px]">{t('hero.sentence')}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button href={SITE.download} size="lg">
              <ArrowDownloadRegular fontSize={20} />
              {t('hero.download')}
            </Button>
          </div>
          <p className="tabular mt-5 text-[15px] text-muted">{t('hero.meta', { version: SITE.version })}</p>
        </motion.div>
      </div>

      <div className="flex flex-col items-center justify-center gap-5 bg-stage px-[var(--gutter)] py-10 transition-colors duration-500 lg:py-16">
        <motion.div
          className="w-full max-w-[680px]"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.3 }}
        >
          <KeyboardFragment armed={armed} />
        </motion.div>
        <motion.p
          className="flex max-w-[680px] items-center gap-2 self-center text-[15px] text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.1 }}
        >
          <KeyboardRegular fontSize={18} className="shrink-0" />
          {touch ? t('hero.tryItTouch') : t('hero.tryIt')}
        </motion.p>
      </div>
    </section>
  )
}
