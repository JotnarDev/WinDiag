import { LogoSymbol, Wordmark } from './Logo'
import { SITE } from '../lib/site'

/** A holding page while the site is rebuilt. The full site stays in App.jsx. */
export function UnderConstruction() {
  return (
    <main className="flex min-h-[100svh] flex-col bg-bg text-ink">
      <div className="frame flex w-full flex-1 flex-col justify-center py-16">
        <div className="flex items-center gap-[0.19em] text-[clamp(44px,8vw,96px)]">
          <LogoSymbol className="size-[1em] shrink-0" title="WinDiag" />
          <Wordmark className="h-[0.447em] w-auto translate-y-[0.06em]" />
        </div>
        <h1 className="mt-12 max-w-[16ch] font-display text-[clamp(32px,4.4vw,56px)] leading-[1.05] font-semibold tracking-[-0.02em]">
          Under construction.
        </h1>
        <p className="mt-5 max-w-[46ch] text-[18px] leading-[1.5] text-muted">
          We&apos;re rebuilding WinDiag and this site with it. The current version is still free to
          download.
        </p>
        <p className="mt-8">
          <a
            href={SITE.download}
            className="inline-flex h-11 items-center rounded-[4px] bg-accent px-5 text-[16px] font-semibold text-on-accent transition-transform active:scale-[0.97]"
          >
            WinDiag {SITE.version} on GitHub
          </a>
        </p>
      </div>
      <footer className="frame flex w-full flex-wrap justify-between gap-2 border-t border-[color:var(--control-stroke)] py-6 text-[14px] text-muted">
        <span>Test it. Fix it. Hand it over.</span>
        <a href={SITE.repo} className="underline-offset-4 hover:underline">
          Source on GitHub
        </a>
      </footer>
    </main>
  )
}
