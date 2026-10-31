import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '../i18n'
import { cn } from '../lib/cn'
import { EASE, Reveal, RevealItem } from '../lib/motion'

/**
 * Questions on the left, one answer on the right that follows hover, click
 * and keyboard focus. On a phone each answer opens under its question.
 */
export function Faq() {
  const { t } = useI18n()
  const items = t('faq.items')
  const [selected, setSelected] = useState(0)

  return (
    <section id="faq" className="scroll-mt-16 bg-stage py-[clamp(96px,13vw,200px)] transition-colors duration-500">
      <div className="frame grid gap-10 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <RevealItem as="h2" className="mb-10 text-h2">
            {t('faq.title')}
          </RevealItem>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {items.map((item, i) => {
              const active = selected === i
              return (
                <RevealItem as="li" key={item.q}>
                  <button
                    type="button"
                    aria-expanded={active}
                    onClick={() => setSelected(i)}
                    onMouseEnter={() => setSelected(i)}
                    onFocus={() => setSelected(i)}
                    className={cn(
                      'flex w-full items-start gap-4 py-2.5 text-left text-[18px] leading-[1.4] transition-colors duration-200',
                      active ? 'text-ink' : 'text-muted hover:text-ink'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-[9px] size-2 shrink-0 rounded-full transition-[background-color,transform] duration-300',
                        active ? 'scale-125 bg-accent' : 'bg-muted'
                      )}
                    />
                    <span className={cn(active && 'font-semibold')}>{item.q}</span>
                  </button>
                  {/* Phone: the answer opens in place */}
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.p
                        className="overflow-hidden pl-6 text-[19px] leading-[1.45] lg:hidden"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE }}
                      >
                        <span className="block pb-4">{item.a}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </RevealItem>
              )
            })}
          </ul>
        </Reveal>

        <div className="hidden lg:col-span-6 lg:col-start-7 lg:block">
          <div className="sticky top-[120px] pt-[calc(var(--text-h2)*1.04+40px)]">
            <AnimatePresence mode="wait">
              <motion.p
                key={selected}
                aria-live="polite"
                className="m-0 max-w-[34ch] text-[24px] leading-[1.4] tracking-[-0.015em]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {items[selected].a}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
