import { ChevronDownRegular } from '@fluentui/react-icons'
import { cn } from '@/lib/utils'

const FIELD =
  'h-8 w-full rounded-control border border-control-stroke bg-control text-body text-text-primary transition-colors duration-100 hover:bg-control-hover disabled:text-text-disabled'

/** Fluent ComboBox look on a native <select> (keeps native keyboard support). */
export function Select({ id, label, value, onChange, children, className, ...props }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-body">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...props}
          className={cn(
            FIELD,
            'appearance-none truncate pr-9 pl-3 shadow-[inset_0_-1px_0_var(--control-stroke-bottom)]'
          )}
        >
          {children}
        </select>
        <ChevronDownRegular
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-text-secondary"
        />
      </div>
    </div>
  )
}

/** Fluent TextBox: the bottom stroke turns into a 2px accent line on focus. */
export function TextBox({ id, label, className, ...props }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-body">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        className={cn(
          FIELD,
          'px-3 shadow-[inset_0_-1px_0_var(--control-strong)] placeholder:text-text-secondary focus:bg-input-active focus:shadow-[inset_0_-2px_0_var(--accent-fill)] focus-visible:outline-none'
        )}
        {...props}
      />
    </div>
  )
}
