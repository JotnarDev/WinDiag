import { useState } from 'react'
import { useI18n } from '../i18n'
import { cn } from '../lib/cn'
import { Reveal, RevealItem } from '../lib/motion'
import { ToggleSwitch } from '../fragments/ui'

// Each band fills with one of the app's colour palettes when its switch is on
const FIELDS = ['var(--band-windows)', 'var(--band-forest)', 'var(--band-ocean)', 'var(--band-sunset)', 'var(--band-slate)']

function Band({ row, field }) {
  const { t } = useI18n()
  const [on, setOn] = useState(row.on)
  return (
    <div
      style={{ backgroundColor: on ? field : 'var(--bg)' }}
      className="cursor-pointer transition-[background-color] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
      onClick={(e) => {
        if (!e.target.closest('[role="switch"]')) setOn(!on)
      }}
    >
      <div className="frame grid min-h-[132px] gap-x-8 gap-y-3 py-8 sm:min-h-[20vh] lg:grid-cols-12 lg:items-center">
        <div className="flex items-start gap-5 sm:gap-8 lg:col-span-7">
          <div data-ui className="flex w-[88px] shrink-0 items-center gap-2 pt-1.5 sm:pt-2.5">
            <ToggleSwitch checked={on} onChange={setOn} label={row.line} />
            <span className="hidden text-[14px] sm:block">{on ? t('tools.on') : t('tools.off')}</span>
          </div>
          <p
            className={cn(
              'max-w-[30ch] text-[24px] font-semibold leading-[1.15] tracking-[-0.025em] transition-colors duration-500 sm:text-[clamp(26px,2.8vw,36px)]',
              on ? 'text-ink' : 'text-muted'
            )}
          >
            {row.line}
          </p>
        </div>
        <p
          className={cn(
            'max-w-[46ch] pl-[108px] text-[16px] leading-[1.5] transition-[color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:pl-[120px] sm:text-[18px] lg:col-span-4 lg:col-start-9 lg:pl-0',
            on ? 'translate-x-0 text-ink' : 'translate-x-2 text-muted'
          )}
        >
          {row.result}
        </p>
      </div>
    </div>
  )
}

/** Settings that exist in WinDiag, each as a sentence the visitor can switch on. */
export function ToolSwitches() {
  const { t } = useI18n()
  const rows = t('tools.rows')
  return (
    <section id="tools" className="scroll-mt-16 pb-[clamp(96px,13vw,200px)]">
      <Reveal className="frame mb-10 lg:mb-14">
        <RevealItem as="h2" className="text-h2">
          {t('tools.title')}
        </RevealItem>
        <RevealItem as="p" className="mt-6 max-w-[48ch] text-[20px] leading-[1.45]">
          {t('tools.sentence')}
        </RevealItem>
      </Reveal>
      <Reveal amount={0.1}>
        {rows.map((row, i) => (
          <RevealItem key={row.id}>
            <Band row={row} field={FIELDS[i % FIELDS.length]} />
          </RevealItem>
        ))}
      </Reveal>
    </section>
  )
}
