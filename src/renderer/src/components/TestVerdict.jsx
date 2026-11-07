import {
  CheckmarkCircleFilled,
  CheckmarkCircleRegular,
  DismissCircleFilled,
  DismissCircleRegular
} from '@fluentui/react-icons'
import { useTestVerdict } from '@/context/TestResultsContext'
import { cn } from '@/lib/utils'

const OPTIONS = [
  {
    value: 'pass',
    label: 'Works',
    icon: CheckmarkCircleRegular,
    activeIcon: CheckmarkCircleFilled,
    active: 'bg-success-bg text-success'
  },
  {
    value: 'fail',
    label: 'Has a problem',
    icon: DismissCircleRegular,
    activeIcon: DismissCircleFilled,
    active: 'bg-critical-bg text-critical'
  }
]

/**
 * The technician's verdict for a test that needs eyes or ears (display,
 * speakers…). It shows on the Overview; pressing the chosen option again
 * clears it.
 */
export function TestVerdict({ test }) {
  const [verdict, setVerdict] = useTestVerdict(test)
  return (
    <div
      role="group"
      aria-label="Test result"
      className="inline-flex h-8 items-center gap-0.5 rounded-control border border-control-stroke bg-control p-0.5"
    >
      {OPTIONS.map(({ value, label, icon, activeIcon, active }) => {
        const isActive = verdict === value
        const Icon = isActive ? activeIcon : icon
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            onClick={() => setVerdict(isActive ? null : value)}
            className={cn(
              'inline-flex h-full items-center gap-1.5 rounded-[3px] px-2.5 text-body whitespace-nowrap transition-colors duration-100',
              isActive
                ? cn(active, 'font-semibold')
                : 'text-text-secondary hover:bg-subtle-hover hover:text-text-primary'
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
