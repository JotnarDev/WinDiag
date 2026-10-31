import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Battery6Regular,
  DesktopRegular,
  HardDriveRegular,
  KeyboardMouseRegular,
  PlayRegular,
  Speaker2Regular,
  TapSingleRegular,
  UsbPlugRegular,
  Wifi1Regular
} from '@fluentui/react-icons'
import { useI18n } from '../i18n'
import { cn } from '../lib/cn'
import { EASE, Reveal, RevealItem } from '../lib/motion'
import { DisplayTest } from './DisplayTest'

// The same icons as the app's navigation pane
const ICONS = {
  display: DesktopRegular,
  touch: TapSingleRegular,
  keyboard: KeyboardMouseRegular,
  audio: Speaker2Regular,
  battery: Battery6Regular,
  disk: HardDriveRegular,
  ports: UsbPlugRegular,
  wireless: Wifi1Regular
}

const STATUS_STYLE = {
  pass: 'bg-success-bg text-success',
  attention: 'bg-caution-bg text-caution'
}

const LAYOUT = { duration: 0.6, ease: EASE }

function Row({ row, open, onOpen, onTryDisplay }) {
  const { t } = useI18n()
  const Icon = ICONS[row.id]
  return (
    <motion.li
      layout
      transition={{ layout: LAYOUT }}
      className={cn(
        'list-none overflow-hidden rounded-[4px] transition-colors duration-500',
        open ? 'bg-accent text-on-accent' : 'bg-stage text-ink hover:bg-raise'
      )}
    >
      <motion.button
        layout="position"
        type="button"
        aria-expanded={open}
        onClick={() => onOpen(row.id)}
        className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-4 px-4 text-left sm:min-h-[72px] sm:px-6 lg:grid-cols-12"
      >
        <span className="flex min-w-0 items-center gap-4 lg:col-span-5">
          <Icon fontSize={24} className="shrink-0" />
          <span className={cn('truncate py-0.5 font-semibold leading-[1.3] tracking-[-0.02em]', open ? 'text-[24px] sm:text-[30px]' : 'text-[20px] sm:text-[26px]')}>
            {row.name}
          </span>
        </span>
        {row.facts.map((fact) => (
          <span
            key={fact}
            className={cn('tabular hidden text-[17px] lg:col-span-2 lg:block', open ? 'text-on-accent' : 'text-muted')}
          >
            {fact}
          </span>
        ))}
        <span className="flex justify-end lg:col-span-1">
          <span className={cn('rounded-[4px] px-3 py-1.5 text-[15px] font-semibold', STATUS_STYLE[row.status])}>
            {t(`board.status.${row.status}`)}
          </span>
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.4 } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="grid gap-6 px-4 pb-6 sm:px-6 lg:grid-cols-12"
          >
            <div className="lg:col-span-5 lg:col-start-1 lg:pl-10">
              <ul className="mb-4 flex flex-col gap-1 text-[16px] lg:hidden">
                {row.facts.map((fact) => (
                  <li key={fact} className="tabular">
                    {fact}
                  </li>
                ))}
              </ul>
              <p className="max-w-[56ch] text-[17px] leading-[1.5]">{row.detail}</p>
              {row.id === 'display' && (
                <button
                  type="button"
                  onClick={onTryDisplay}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-[4px] bg-on-accent px-5 text-[16px] font-semibold text-accent transition-transform active:scale-[0.97]"
                >
                  <PlayRegular fontSize={18} />
                  {t('board.tryDisplay')}
                </button>
              )}
            </div>
            {row.id === 'ports' && (
              <figure className="m-0 lg:col-span-5 lg:col-start-8">
                <img
                  src="./photos/toughbook-cf30.jpg"
                  alt="The rear panel of a Panasonic Toughbook CF-30: USB, serial, VGA, audio and docking ports."
                  width="1200"
                  height="800"
                  loading="lazy"
                  className="aspect-[3/2] w-full object-cover"
                />
                <figcaption className="pt-2 text-[15px]">{t('board.portsPhoto')}</figcaption>
              </figure>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

/** The eight hardware tests as a board of rows; one row is open at a time. */
export function TestBoard() {
  const { t } = useI18n()
  const rows = t('board.rows')
  const [open, setOpen] = useState('keyboard')
  const [displayOpen, setDisplayOpen] = useState(false)

  return (
    <section id="tests" className="scroll-mt-16 py-[clamp(96px,13vw,200px)]">
      <Reveal className="frame mb-12 grid gap-6 lg:mb-16 lg:grid-cols-12">
        <RevealItem as="h2" className="text-h2 lg:col-span-7">
          {t('board.title')}
        </RevealItem>
        <RevealItem as="p" className="max-w-[40ch] self-end text-[20px] leading-[1.45] lg:col-span-4 lg:col-start-9">
          {t('board.sentence')}
        </RevealItem>
      </Reveal>

      <Reveal amount={0.1} className="frame">
        <RevealItem>
          <ul data-ui aria-label={t('board.sample')} className="m-0 flex flex-col gap-1 p-0 text-ink">
            {rows.map((row) => (
              <Row
                key={row.id}
                row={row}
                open={open === row.id}
                onOpen={setOpen}
                onTryDisplay={() => setDisplayOpen(true)}
              />
            ))}
          </ul>
        </RevealItem>
      </Reveal>

      <DisplayTest open={displayOpen} onClose={() => setDisplayOpen(false)} />
    </section>
  )
}
