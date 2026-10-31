import { ArrowDownloadRegular, UsbStickRegular } from '@fluentui/react-icons'
import { useI18n } from '../i18n'
import { SITE } from '../lib/site'
import { cn } from '../lib/cn'
import { Reveal, RevealItem } from '../lib/motion'
import { Button } from './Button'

/** The plain last word: one sentence and one action. */
export function Cta() {
  const { t } = useI18n()
  return (
    <section aria-labelledby="cta-title" className="frame grid gap-14 py-[clamp(96px,13vw,200px)] lg:grid-cols-12 lg:items-end">
      <Reveal className="lg:col-span-6">
        <RevealItem as="h2" id="cta-title" className="text-h2">
          {t('cta.title')}
        </RevealItem>
        <RevealItem as="p" className="mt-6 max-w-[40ch] text-[20px] leading-[1.45]">
          {t('cta.sentence')}
        </RevealItem>
        <RevealItem className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
          <Button href={SITE.download}>
            <ArrowDownloadRegular fontSize={18} />
            {t('cta.download')}
          </Button>
          <Button variant="quiet" href={SITE.repo} className="text-[17px]">
            {t('cta.github')}
          </Button>
        </RevealItem>
      </Reveal>
      <Reveal className="lg:col-span-5 lg:col-start-8">
        <RevealItem as="h3" className="mb-4 text-[16px] font-normal text-muted">
          {t('cta.filesTitle')}
        </RevealItem>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {t('cta.files').map((file, i) => (
            <RevealItem as="li" key={file.name} className="flex items-start gap-4 rounded-[8px] bg-stage p-5 transition-colors duration-500">
              {i === 0 ? (
                <ArrowDownloadRegular fontSize={24} className="mt-0.5 shrink-0 text-accent" />
              ) : (
                <UsbStickRegular fontSize={24} className="mt-0.5 shrink-0 text-accent" />
              )}
              <span>
                <span className="block text-[18px] font-semibold">{file.name}</span>
                <span className="block text-[16px] leading-[1.5]">{file.detail}</span>
              </span>
            </RevealItem>
          ))}
        </ul>
        <RevealItem as="p" className="mt-4 text-[15px] text-muted">
          {t('cta.requirements')}
        </RevealItem>
      </Reveal>
    </section>
  )
}

function Tile({ className, children, ...rest }) {
  return (
    <div className={cn('flex flex-col rounded-[4px] bg-stage p-5 transition-colors duration-500 sm:p-6', className)} {...rest}>
      {children}
    </div>
  )
}

const formatDate = (iso, locale) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

/** The footer as the last rows of a board: every tile filled, the name at full width. */
export function Footer() {
  const { t, locale } = useI18n()
  const links = [
    ['releases', 'https://github.com/JotnarDev/WinDiag/releases'],
    ['changelog', SITE.changelog],
    ['guide', SITE.driverGuide],
    ['issues', SITE.issues]
  ]
  return (
    <footer className="px-2 pb-2 sm:px-3 sm:pb-3">
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-12 lg:gap-2">
        <Tile className="order-5 col-span-2 justify-between gap-8 lg:order-none lg:col-span-4 lg:min-h-[220px]">
          <p className="max-w-[28ch] text-[22px] leading-[1.3] tracking-[-0.015em]">{t('footer.statement')}</p>
          <p className="text-[14px] text-muted">{t('footer.legal')}</p>
        </Tile>
        <Tile className="order-3 lg:order-none lg:col-span-3">
          <h2 className="mb-3 text-[14px] font-normal tracking-normal text-muted">{t('footer.links')}</h2>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[16px]">
            {links.map(([id, href]) => (
              <li key={id}>
                <a href={href} className="underline-offset-4 hover:underline">
                  {t(`footer.linkItems.${id}`)}
                </a>
              </li>
            ))}
          </ul>
        </Tile>
        <Tile className="order-4 justify-between gap-6 lg:order-none lg:col-span-2">
          <h2 className="text-[14px] font-normal tracking-normal text-muted">{t('footer.release')}</h2>
          <div>
            <a href={SITE.changelog} className="tabular block text-[20px] font-semibold hover:underline">
              {t('footer.releaseLine', { version: SITE.version })}
            </a>
            <p className="text-[15px] text-muted">{t('footer.releaseDate', { date: formatDate(SITE.released, locale) })}</p>
          </div>
        </Tile>
        <Tile className="order-6 col-span-2 justify-between gap-6 lg:order-none lg:col-span-3">
          <h2 className="text-[14px] font-normal tracking-normal text-muted">{t('footer.help')}</h2>
          <a href={SITE.issues} className="text-[20px] underline decoration-[1.5px] underline-offset-4">
            {t('footer.helpLink')}
          </a>
        </Tile>

        <div className="order-1 col-span-2 flex min-h-[160px] items-center justify-center overflow-hidden rounded-[4px] bg-inverse text-on-inverse transition-colors duration-500 lg:order-none lg:col-span-8 lg:min-h-[320px]">
          <span className="select-none text-[clamp(64px,13vw,200px)] font-semibold leading-none tracking-[-0.05em]" aria-hidden="true">
            WinDiag
          </span>
        </div>
        <a
          href={SITE.download}
          className="group order-2 col-span-2 flex min-h-[160px] flex-col justify-between rounded-[4px] bg-accent p-5 text-on-accent transition-[filter] duration-300 hover:brightness-110 sm:p-6 lg:order-none lg:col-span-4 lg:min-h-[320px]"
        >
          <span className="text-[28px] font-semibold tracking-[-0.025em]">{t('footer.invite')}</span>
          <svg
            className="size-14 self-end transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 group-hover:translate-y-1"
            viewBox="0 0 56 56"
            fill="none"
            aria-hidden="true"
          >
            <path d="M12 12L44 44M44 18V44H18" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
          </svg>
        </a>
      </div>
      <p className="max-w-[96ch] px-2 pt-5 text-[14px] leading-[1.6] text-muted sm:px-3">
        {t('footer.credits')}:{' '}
        <a className="underline" href="https://commons.wikimedia.org/wiki/File:Panasonic_Toughbook_CF-19_fully-rugged_laptop.jpg">“Panasonic Toughbook CF-19 fully-rugged laptop”</a> by Ali from Riyadh,{' '}
        <a className="underline" href="https://creativecommons.org/licenses/by/2.0">CC BY 2.0</a>;{' '}
        <a className="underline" href="https://commons.wikimedia.org/wiki/File:Panasonic_Toughbook_CF-30_(5).jpg">“Panasonic Toughbook CF-30 (5)”</a> by Museum of Transport and Technology,{' '}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>. All via Wikimedia Commons.
      </p>
    </footer>
  )
}
