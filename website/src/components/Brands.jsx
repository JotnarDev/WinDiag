import { useI18n } from '../i18n'
import { Reveal, RevealItem } from '../lib/motion'
import { BrandMarquee } from './BrandMarquee'

/** Any brand of PC: the title, one sentence and the makers' logos sliding past. */
export function Brands() {
  const { t } = useI18n()
  const [first, second] = t('brands.titleLines')
  return (
    <section id="brands" className="scroll-mt-16 py-[clamp(96px,13vw,200px)]">
      <Reveal className="frame">
        <RevealItem as="h2" className="text-h2">
          <span className="block">{first}</span>
          <span className="block text-muted">{second}</span>
        </RevealItem>
        <RevealItem as="p" className="mt-6 max-w-[52ch] text-[18px]">
          {t('brands.sentence')}
        </RevealItem>
      </Reveal>
      <BrandMarquee label={t('brands.label')} className="mt-16" />
    </section>
  )
}
