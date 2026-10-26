import { useCallback, useEffect, useState } from 'react'
import {
  BatteryFull,
  Fan,
  FingerprintPattern,
  HardDrive,
  Keyboard,
  LayoutDashboard,
  Monitor,
  Radar,
  ShieldAlert,
  Usb,
  Users,
  Volume2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard
  },
  {
    id: 'display',
    label: 'Display',
    icon: Monitor
  },
  {
    id: 'touch',
    label: 'Touch',
    icon: FingerprintPattern
  },
  {
    id: 'keyboard',
    label: 'Keyboard & Mouse',
    icon: Keyboard
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: Volume2
  },
  {
    id: 'battery',
    label: 'Battery',
    icon: BatteryFull
  },
  {
    id: 'disk',
    label: 'Disk Health',
    icon: HardDrive
  },
  {
    id: 'fans',
    label: 'Fans',
    icon: Fan
  },
  {
    id: 'ports',
    label: 'Ports',
    icon: Usb
  },
  {
    id: 'otherDevices',
    label: 'Other Devices',
    icon: Radar
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users
  }
]

export function Sidebar({ activeModule, onSelectModule }) {
  const [isElevated, setIsElevated] = useState(null)
  const [relaunching, setRelaunching] = useState(false)
  const [relaunchError, setRelaunchError] = useState(null)
  useEffect(() => {
    void window.api.isElevated().then(setIsElevated)
  }, [])
  const handleRunAsAdmin = useCallback(async () => {
    setRelaunching(true)
    setRelaunchError(null)
    const result = await window.api.relaunchAsAdmin()
    if (!result.success) {
      setRelaunchError(result.message)
      setRelaunching(false)
    }
  }, [])
  return (
    <aside className="flex h-screen w-60 flex-col bg-black text-[#f2f2f2] shadow-[1px_0_3px_rgba(0,0,0,0.4)]">
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="h-8 w-8 shrink-0 rounded-full bg-[#FF5A00]" />
        <span className="text-[16px] font-medium tracking-tight text-white">WinDiag</span>
      </div>
      {isElevated === false && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={handleRunAsAdmin}
            disabled={relaunching}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[#FF5A00]/40 bg-[#FF5A00]/[0.12] px-4 py-2 text-[12.5px] font-medium text-[#FF5A00] transition-colors hover:bg-[#FF5A00]/[0.2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldAlert className="h-[15px] w-[15px] shrink-0" />
            {relaunching ? 'Relaunching…' : 'Run as Administrator'}
          </button>
          {relaunchError && (
            <p className="mt-1.5 px-1 text-[11px] leading-snug text-[#FF6B6B]">{relaunchError}</p>
          )}
        </div>
      )}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map(({ id, label, icon: Icon2 }) => {
          const isActive = id === activeModule
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectModule(id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-[13.5px] font-medium transition-colors',
                isActive
                  ? 'bg-[#FF5A00]/[0.16] text-white'
                  : 'text-[#B0B0B0] hover:bg-white/[0.06] hover:text-white'
              )}
            >
              <Icon2
                className={cn(
                  'h-[18px] w-[18px] shrink-0',
                  isActive ? 'text-[#FF5A00]' : 'text-[#8A8A8A]'
                )}
              />
              {label}
            </button>
          )
        })}
      </nav>
      <div className="px-6 py-4 text-[11px] font-medium text-[#7A7A7A]">
        v0.1.4 · Beta by JOTNAR
      </div>
    </aside>
  )
}
