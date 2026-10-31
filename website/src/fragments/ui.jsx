import { cn } from '../lib/cn'

/*
 * Small Fluent controls for the interface fragments. They copy WinDiag's own
 * components (components/ui in the app): 4px controls, 8px cards, 1px strokes.
 */

export function UiButton({ accent, className, children, ...rest }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-[4px] px-3 text-[14px] transition-[background-color,transform] duration-150 active:scale-[0.97]',
        accent
          ? 'bg-accent text-on-accent hover:opacity-90'
          : 'border border-control-stroke bg-control text-ui-text hover:bg-control-hover',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** WinUI ToggleSwitch: 40×20 track, a knob that slides and grows on hover. */
export function ToggleSwitch({ checked, onChange, label, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('group relative inline-flex h-11 w-14 shrink-0 items-center justify-center', className)}
    >
      <span
        className={cn(
          'relative block h-5 w-10 rounded-full border transition-colors duration-200',
          checked ? 'border-transparent bg-accent' : 'border-control-strong bg-control'
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 block size-3 -translate-y-1/2 rounded-full transition-[left,width,height,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:size-3.5',
            checked ? 'left-[calc(100%-16px)] bg-on-accent group-hover:left-[calc(100%-18px)]' : 'left-[3px] bg-control-strong'
          )}
        />
      </span>
    </button>
  )
}

export function ProgressBar({ value, indeterminate }) {
  return (
    <div className="relative h-1 w-full overflow-hidden rounded-full bg-control-stroke">
      {indeterminate ? (
        <div className="absolute inset-y-0 w-1/3 animate-[slide_1.1s_cubic-bezier(0.4,0,0.2,1)_infinite] rounded-full bg-accent" />
      ) : (
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${value * 100}%` }}
        />
      )}
    </div>
  )
}
