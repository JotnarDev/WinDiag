import { useReducedMotion } from 'motion/react'
import { BRAND_LOGOS } from '../lib/brand-logos'
import { cn } from '../lib/cn'

// Logos are sized by area, not height, so a square badge and a long
// wordmark look equally heavy: height = BASE / √(width ÷ height).
const BASE = 44
const MIN_HEIGHT = 16

function sizeOf(viewBox) {
  const [, , w, h] = viewBox.split(' ').map(Number)
  const aspect = w / h
  const height = Math.max(MIN_HEIGHT, BASE / Math.sqrt(aspect))
  return { width: Math.round(height * aspect), height: Math.round(height) }
}

function Logo({ brand }) {
  const mark = brand.path ? (
    <svg viewBox={brand.viewBox} {...sizeOf(brand.viewBox)} fill="currentColor" aria-hidden className="shrink-0">
      <path d={brand.path} />
    </svg>
  ) : null
  return (
    <li className="flex shrink-0 list-none items-center gap-2.5 text-muted transition-colors duration-300 hover:text-ink">
      {mark}
      {brand.showName ? (
        <span className="text-[22px] font-semibold tracking-[-0.01em]">{brand.name}</span>
      ) : (
        <span className="sr-only">{brand.name}</span>
      )}
    </li>
  )
}

/** The makers WinDiag runs on, sliding past; still and wrapped for reduced motion. */
export function BrandMarquee({ label, className }) {
  const reduced = useReducedMotion()
  if (reduced) {
    return (
      <ul aria-label={label} className={cn('frame m-0 flex flex-wrap items-center gap-x-12 gap-y-8 p-0', className)}>
        {BRAND_LOGOS.map((brand) => (
          <Logo key={brand.id} brand={brand} />
        ))}
      </ul>
    )
  }
  // The second copy makes the loop seamless; screen readers hear the list once
  return (
    <div className={cn('marquee overflow-hidden', className)} role="region" aria-label={label}>
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            aria-hidden={copy === 1 || undefined}
            className="m-0 flex shrink-0 items-center gap-16 p-0 pr-16 sm:gap-20 sm:pr-20"
          >
            {BRAND_LOGOS.map((brand) => (
              <Logo key={brand.id} brand={brand} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
