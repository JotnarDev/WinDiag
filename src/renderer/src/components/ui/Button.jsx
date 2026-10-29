import { cn } from '@/lib/utils'

const VARIANTS = {
  // The one main action on a surface
  accent:
    'border-transparent bg-accent-fill text-text-on-accent shadow-[inset_0_-1px_0_rgb(0_0_0/0.25)] hover:bg-accent-fill-secondary active:bg-accent-fill-tertiary active:shadow-none disabled:bg-text-disabled disabled:shadow-none',
  standard:
    'border-control-stroke bg-control text-text-primary shadow-[inset_0_-1px_0_var(--control-stroke-bottom)] hover:bg-control-hover active:bg-control-pressed active:text-text-secondary active:shadow-none disabled:bg-control-disabled disabled:text-text-disabled disabled:shadow-none',
  // No chrome until hovered: toolbars, title bar, dismiss buttons
  subtle:
    'border-transparent bg-transparent text-text-primary hover:bg-subtle-hover active:bg-subtle-pressed active:text-text-secondary disabled:text-text-disabled',
  // Destructive confirmation (used sparingly, only inside dialogs)
  danger:
    'border-transparent bg-critical text-[var(--solid-bg)] hover:opacity-90 active:opacity-80 disabled:bg-text-disabled'
}

/**
 * Fluent button: 32px tall, 4px corners, 16px icons. `icon` is a Fluent icon
 * component; with no children the button is a square icon button and needs
 * an aria-label.
 */
export function Button({
  variant = 'standard',
  icon: Icon,
  iconClassName,
  className,
  children,
  type = 'button',
  ...props
}) {
  const iconOnly = !children
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-control border text-body whitespace-nowrap transition-colors duration-100 disabled:pointer-events-none',
        iconOnly ? 'w-8' : 'px-3',
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {Icon && <Icon aria-hidden className={cn('size-4 shrink-0', iconClassName)} />}
      {children}
    </button>
  )
}
