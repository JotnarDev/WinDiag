import { cn } from '@/lib/utils'

/**
 * A navigation page: Title-style heading, optional description and commands,
 * content capped at Settings' 1000px reading width.
 */
export function Page({ title, description, actions, className, children }) {
  return (
    <div
      className={cn('page-enter mx-auto w-full max-w-[1000px] px-5 pt-2 pb-10 sm:px-10', className)}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-[680px]">
          <h1 className="font-display text-title font-semibold">{title}</h1>
          {description && <p className="mt-1 text-body text-text-secondary">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  )
}
