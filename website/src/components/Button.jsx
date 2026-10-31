import { cn } from '../lib/cn'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-[4px] font-semibold whitespace-nowrap select-none ' +
  'transition-[transform,background-color,color,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ' +
  'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none'

const VARIANTS = {
  accent: 'bg-accent text-on-accent hover:opacity-90',
  inverse: 'bg-inverse text-on-inverse hover:opacity-85',
  quiet: 'text-ink underline decoration-[1.5px] underline-offset-4 decoration-current/40 hover:decoration-current'
}

const SIZES = {
  md: 'h-11 px-5 text-[16px]',
  lg: 'h-13 px-7 text-[17px]'
}

/** The page's one button shape: flat fill, 4px corners like a Windows 11 control. */
export function Button({ as: Tag = 'a', variant = 'accent', size = 'md', className, children, ...rest }) {
  return (
    <Tag className={cn(BASE, VARIANTS[variant], variant !== 'quiet' && SIZES[size], className)} {...rest}>
      {children}
    </Tag>
  )
}
