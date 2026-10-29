import { useEffect, useId, useRef } from 'react'
import {
  CheckmarkCircleFilled,
  DismissCircleFilled,
  DismissRegular,
  InfoFilled,
  WarningFilled
} from '@fluentui/react-icons'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const SEVERITY = {
  info: { icon: InfoFilled, bg: 'bg-neutral-bg', fg: 'text-accent-fill', role: 'status' },
  success: {
    icon: CheckmarkCircleFilled,
    bg: 'bg-success-bg',
    fg: 'text-success',
    role: 'status'
  },
  warning: { icon: WarningFilled, bg: 'bg-caution-bg', fg: 'text-caution', role: 'status' },
  error: { icon: DismissCircleFilled, bg: 'bg-critical-bg', fg: 'text-critical', role: 'alert' }
}

/**
 * Fluent InfoBar: an in-page message about the app or a task's outcome.
 * Errors are announced immediately to screen readers; the rest politely.
 */
export function InfoBar({ severity = 'info', title, children, action, onDismiss, className }) {
  const { icon: Icon, bg, fg, role } = SEVERITY[severity]
  return (
    <div
      role={role}
      className={cn(
        'flex min-h-12 items-start gap-3 rounded-control border border-card-stroke px-4 py-3',
        bg,
        className
      )}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', fg)} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 basis-60">
          {title && <span className="mr-2 font-semibold">{title}</span>}
          {children}
        </p>
        {action && <div className="flex shrink-0 gap-2">{action}</div>}
      </div>
      {onDismiss && (
        <Button
          variant="subtle"
          icon={DismissRegular}
          aria-label="Close"
          className="-my-1.5 -mr-2"
          onClick={onDismiss}
        />
      )}
    </div>
  )
}

const BADGE_TONES = {
  success: 'bg-success-bg text-success',
  caution: 'bg-caution-bg text-caution',
  critical: 'bg-critical-bg text-critical',
  accent: 'bg-accent-fill text-text-on-accent',
  neutral: 'border border-control-stroke bg-control-alt text-text-secondary'
}

/** Small status label (Fluent 2 badge). */
export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-caption font-semibold whitespace-nowrap',
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

const PROGRESS_TONES = {
  accent: 'bg-accent-fill',
  success: 'bg-success',
  caution: 'bg-caution',
  critical: 'bg-critical'
}

/** Fluent progress bar: a 3px rail over a 1px track; no value = indeterminate. */
export function ProgressBar({ value, tone = 'accent', label, className }) {
  const indeterminate = value === undefined || value === null
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      className={cn('relative flex h-[3px] w-full items-center overflow-hidden', className)}
    >
      <div className="absolute inset-x-0 h-px bg-control-strong" />
      {indeterminate ? (
        <div
          className={cn(
            'absolute h-[3px] w-2/5 rounded-full [animation:fluent-indeterminate_1.6s_ease-in-out_infinite]',
            PROGRESS_TONES[tone]
          )}
        />
      ) : (
        <div
          className={cn(
            'absolute left-0 h-[3px] rounded-full transition-[width] duration-200',
            PROGRESS_TONES[tone]
          )}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      )}
    </div>
  )
}

/** Indeterminate progress ring (the spinning arc). */
export function ProgressRing({ size = 16, className, label = 'Loading' }) {
  const stroke = size >= 32 ? 3 : 2
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <svg
      role="progressbar"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0 [animation:fluent-spin_1s_linear_infinite]', className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent-fill)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference * 0.3} ${circumference}`}
      />
    </svg>
  )
}

/** Fluent ToggleSwitch with its On/Off text, for settings that apply at once. */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
  onText = 'On',
  offText = 'Off'
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-3 rounded-control disabled:pointer-events-none"
    >
      <span className={cn('text-body', disabled && 'text-text-disabled')}>
        {checked ? onText : offText}
      </span>
      <span
        className={cn(
          'relative inline-flex h-5 w-10 shrink-0 items-center rounded-full border transition-colors duration-100',
          checked
            ? 'border-transparent bg-accent-fill group-hover:bg-accent-fill-secondary'
            : 'border-control-strong bg-control-alt group-hover:bg-subtle-hover',
          disabled && (checked ? 'bg-text-disabled' : 'border-text-disabled')
        )}
      >
        <span
          className={cn(
            'absolute size-3 rounded-full transition-all duration-150 group-hover:size-3.5 group-active:w-4',
            checked
              ? 'left-[calc(100%-16px)] bg-text-on-accent group-hover:left-[calc(100%-17px)] group-active:left-[calc(100%-19px)]'
              : 'left-[3px] bg-text-secondary group-hover:left-[2px]',
            disabled && !checked && 'bg-text-disabled'
          )}
        />
      </span>
    </button>
  )
}

/**
 * Fluent ContentDialog on top of the native <dialog>: modal, traps focus,
 * closes with Esc, and returns focus to whatever opened it.
 */
export function ContentDialog({
  open,
  title,
  children,
  primaryText,
  primaryVariant = 'accent',
  onPrimary,
  closeText = 'Cancel',
  onClose,
  busy = false
}) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[548px] overflow-hidden rounded-overlay border border-card-stroke bg-flyout p-0 text-text-primary shadow-dialog"
    >
      {open && (
        <>
          <div className="px-6 pt-6 pb-6">
            <h2 id={titleId} className="mb-3 font-display text-subtitle font-semibold">
              {title}
            </h2>
            <div className="text-body">{children}</div>
          </div>
          <div className="grid auto-cols-fr grid-flow-col gap-2 border-t border-card-stroke bg-solid-bg p-6">
            {onPrimary && (
              <Button variant={primaryVariant} disabled={busy} onClick={onPrimary} autoFocus>
                {primaryText}
              </Button>
            )}
            <Button disabled={busy} onClick={onClose} autoFocus={!onPrimary}>
              {closeText}
            </Button>
          </div>
        </>
      )}
    </dialog>
  )
}
