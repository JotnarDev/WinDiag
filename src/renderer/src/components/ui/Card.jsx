import { useId, useState } from 'react'
import { ChevronDownRegular, ChevronRightRegular } from '@fluentui/react-icons'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-overlay border border-card-stroke bg-card', className)}
      {...props}
    />
  )
}

/** A titled group of cards, like the sections of Windows 11 Settings. */
export function Section({ title, description, actions, className, children }) {
  return (
    <section className={cn('mt-7 first:mt-0', className)}>
      {(title || actions) && (
        <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="text-body font-semibold">{title}</h2>}
            {description && <p className="text-caption text-text-secondary">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}

function CardHeaderContent({ icon: Icon, iconNode, title, description }) {
  return (
    <>
      {iconNode ?? (Icon && <Icon aria-hidden className="size-5 shrink-0 text-text-primary" />)}
      <div className="min-w-0 flex-1">
        <div className="text-body">{title}</div>
        {description && <div className="text-caption text-text-secondary">{description}</div>}
      </div>
    </>
  )
}

/**
 * The Windows 11 Settings row: icon, title and description on the left, the
 * control on the right (or below, with `stacked`, for wide controls).
 * Passing onClick makes the whole card a button that opens something (shown
 * with a chevron).
 */
export function SettingsCard({
  icon,
  iconNode,
  title,
  description,
  children,
  onClick,
  disabled,
  stacked = false,
  trailingIcon: TrailingIcon = ChevronRightRegular,
  className
}) {
  const content = (
    <>
      <CardHeaderContent icon={icon} iconNode={iconNode} title={title} description={description} />
      {children && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2',
            stacked ? 'w-full sm:pl-9' : 'shrink-0'
          )}
        >
          {children}
        </div>
      )}
      {onClick && TrailingIcon && (
        <TrailingIcon aria-hidden className="size-4 shrink-0 text-text-secondary" />
      )}
    </>
  )
  const base =
    'flex min-h-[68px] w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-overlay border border-card-stroke bg-card px-4 py-3 text-left'
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          base,
          'transition-colors duration-100 hover:bg-control-hover active:bg-control-pressed disabled:opacity-60',
          className
        )}
      >
        {content}
      </button>
    )
  }
  return <div className={cn(base, className)}>{content}</div>
}

/**
 * A settings card that opens to show more detail. The header can still hold
 * a control (children of `header`), which doesn't toggle the expander.
 */
export function Expander({
  icon,
  iconNode,
  title,
  description,
  headerContent,
  defaultExpanded = false,
  className,
  children
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentId = useId()
  return (
    <div className={cn('rounded-overlay border border-card-stroke bg-card', className)}>
      <div className="flex min-h-[68px] items-center gap-2 pr-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-[68px] min-w-0 flex-1 items-center gap-4 rounded-overlay py-3 pl-4 text-left"
        >
          <CardHeaderContent
            icon={icon}
            iconNode={iconNode}
            title={title}
            description={description}
          />
        </button>
        {headerContent && <div className="flex shrink-0 items-center gap-2">{headerContent}</div>}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => setExpanded((value) => !value)}
          className="flex size-8 shrink-0 items-center justify-center rounded-control hover:bg-subtle-hover active:bg-subtle-pressed"
        >
          <ChevronDownRegular
            className={cn(
              'size-4 text-text-secondary transition-transform duration-200',
              expanded && 'rotate-180'
            )}
          />
        </button>
      </div>
      <div
        id={contentId}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden" inert={!expanded}>
          <div className="border-t border-divider px-4 py-4 sm:pl-[52px]">{children}</div>
        </div>
      </div>
    </div>
  )
}

/** Label/value pairs, like "Device specifications" in Settings → About. */
export function PropertyList({ items, className }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[minmax(120px,max-content)_1fr]',
        className
      )}
    >
      {items.filter(Boolean).map(([label, value, valueClassName]) => (
        <div key={label} className="contents">
          <dt className="text-text-secondary">{label}</dt>
          <dd className={cn('selectable m-0 mb-1 break-words sm:mb-0', valueClassName)}>
            {value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}
