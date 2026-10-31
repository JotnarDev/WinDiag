import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useI18n } from '../i18n'
import { SITE } from '../lib/site'
import { cn } from '../lib/cn'
import { EASE, Reveal, RevealItem } from '../lib/motion'
import { Button } from './Button'

// Latest BIOS/EC on each maker's support site, checked 2026-10-29.
// "raw" is the model string Windows reports; Panasonic adds the generation.
const MODELS = {
  panasonic: [
    { raw: 'FZ55-1', model: 'FZ-55 MK1', bios: 'V1.00L27', ec: 'V1.00L15' },
    { raw: 'FZ55-2', model: 'FZ-55 MK2', bios: 'V2.00L31', ec: 'V2.00L14' },
    { raw: 'FZ55-3', model: 'FZ-55 MK3', bios: 'V3.00L22', ec: 'V3.00L11' },
    { raw: 'FZ40-1', model: 'FZ-40 MK1', bios: 'V1.00L30', ec: 'V1.00L16' },
    { raw: 'CF-54-3', model: 'CF-54 MK3', bios: 'V3.00L29', ec: 'V3.00L14' },
    { raw: 'CF-31-6', model: 'CF-31 MK6', bios: 'V6.00L21', ec: 'V6.00L11' }
  ],
  getac: [
    { model: 'S410 G5', bios: 'R1.16', ec: 'R1.05' },
    { model: 'B360 G2', bios: 'R1.17', ec: 'R1.17' },
    { model: 'V110 G7', bios: 'R1.09', ec: 'R1.06' },
    { model: 'K120 G1', bios: 'R1.21.070520', ec: 'R1.10' }
  ],
  dell: [
    { model: 'Latitude 5420 Rugged', bios: '1.44.0' },
    { model: 'Latitude 5430 Rugged', bios: '1.46.0' },
    { model: 'Latitude 7330 Rugged Extreme', bios: '1.46.0' },
    { model: 'Pro Rugged 14', bios: '1.20.0' }
  ]
}

const PHOTOS = {
  panasonic: { src: './photos/toughbook-cf19.jpg', w: 1000, h: 1333, alt: 'A Panasonic Toughbook CF-19 open on a carpet, its screen showing a web page.' },
  getac: { src: './photos/getac-b360.jpg', w: 1600, h: 1205, alt: 'A black Getac B360 rugged laptop on a white exhibition table, beside its spec card.' },
  dell: { src: './photos/dell-latitude-rugged.jpg', w: 1600, h: 1060, alt: 'Dell Latitude Rugged tablets and a laptop on a red exhibition table.' }
}

function ModelBand({ row }) {
  const { t } = useI18n()
  return (
    <motion.li
      variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
      className="grid list-none grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 rounded-[8px] bg-stage px-5 py-4 transition-colors duration-300 odd:bg-raise hover:bg-bg sm:min-h-[76px] lg:grid-cols-[150px_1fr_auto]">
      <span className="tabular hidden text-[20px] text-muted lg:block">{row.raw ?? '—'}</span>
      <span className="min-w-0">
        <span className="block text-[18px] font-semibold">{row.model}</span>
        {row.raw && (
          <span className="tabular block text-[15px] text-muted lg:hidden">
            {t('rugged.windows')}: {row.raw}
          </span>
        )}
      </span>
      <span className="text-right">
        <span className="tabular block text-[20px] font-semibold">{row.bios}</span>
        <span className="tabular block text-[15px] text-muted">
          {row.ec ? t('rugged.ec', { version: row.ec }) : t('rugged.inBios')}
        </span>
      </span>
    </motion.li>
  )
}

/** Brands as tabs, their models as tone bands, each with the latest official BIOS. */
export function Rugged() {
  const { t } = useI18n()
  const brands = t('rugged.brands')
  const [active, setActive] = useState('panasonic')
  const [first, second] = t('rugged.titleLines')
  const photo = PHOTOS[active]

  return (
    <section id="rugged" className="scroll-mt-16 py-[clamp(96px,13vw,200px)]">
      <Reveal className="frame flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <RevealItem as="h2" className="text-h2">
            <span className="block">{first}</span>
            <span className="block text-muted">{second}</span>
          </RevealItem>
          <RevealItem as="p" className="mt-6 max-w-[52ch] text-[18px]">
            {t('rugged.sentence')}
          </RevealItem>
        </div>
        <RevealItem>
          <Button href={SITE.driverGuide} variant="inverse">
            {t('rugged.guide')}
          </Button>
        </RevealItem>
      </Reveal>

      <div className="frame mt-14 grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-10">
        <div className="flex flex-col gap-6">
          <div role="tablist" aria-label={t('rugged.latestBios')} className="grid grid-cols-3 gap-1.5 lg:grid-cols-1">
            {brands.map((brand) => (
              <button
                key={brand.id}
                role="tab"
                type="button"
                id={`tab-${brand.id}`}
                aria-selected={active === brand.id}
                aria-controls="rugged-panel"
                onClick={() => setActive(brand.id)}
                className={cn(
                  'flex min-h-16 flex-col justify-center rounded-[4px] px-4 text-left transition-colors duration-300',
                  active === brand.id ? 'bg-inverse text-on-inverse' : 'bg-stage text-ink hover:bg-raise'
                )}
              >
                <span className="text-[16px] font-semibold">{brand.name}</span>
                <span className="text-[13px] opacity-75">{brand.line}</span>
              </button>
            ))}
          </div>
          <figure className="m-0 hidden lg:block">
            <div className="aspect-[4/5] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img
                  key={photo.src}
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.w}
                  height={photo.h}
                  loading="lazy"
                  initial={{ opacity: 0, scale: 1.06 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="size-full object-cover"
                />
              </AnimatePresence>
            </div>
            <figcaption className="pt-2 text-[14px] text-muted">{t(`rugged.photos.${active}`)}</figcaption>
          </figure>
        </div>

        <div id="rugged-panel" role="tabpanel" aria-labelledby={`tab-${active}`}>
          <div className="mb-3 hidden grid-cols-[150px_1fr_auto] gap-x-6 px-5 text-[14px] text-muted lg:grid">
            <span>{t('rugged.windows')}</span>
            <span>{t('rugged.shown')}</span>
            <span>{t('rugged.latestBios')}</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.ul
              key={active}
              className="m-0 flex flex-col gap-1 p-0"
              initial="hidden"
              animate="shown"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.05 } } }}
            >
              {MODELS[active].map((row) => (
                <ModelBand key={row.model} row={row} />
              ))}
            </motion.ul>
          </AnimatePresence>
          {active === 'panasonic' && <p className="mt-4 px-1 text-[15px] text-muted">{t('rugged.panasonicNote')}</p>}
          <figure className="m-0 mt-8 lg:hidden">
            <img src={photo.src} alt={photo.alt} width={photo.w} height={photo.h} loading="lazy" className="aspect-[3/2] w-full object-cover" />
            <figcaption className="pt-2 text-[14px] text-muted">{t(`rugged.photos.${active}`)}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}
