import {
  AppsRegular,
  ArrowDownloadRegular,
  DesktopPulseRegular,
  EyeOffRegular,
  HomeRegular,
  PaintBrushRegular,
  RocketRegular,
  ShieldCheckmarkRegular,
  WrenchRegular
} from '@fluentui/react-icons'

// WinDiag (home)'s navigation: the first item is the start page by default
export const HOME_NAV = [
  {
    items: [{ id: 'overview', label: 'Home', icon: HomeRegular }]
  },
  {
    header: 'Improve',
    items: [
      { id: 'speed', label: 'Speed up', icon: RocketRegular },
      { id: 'privacy', label: 'Privacy', icon: EyeOffRegular },
      { id: 'personalize', label: 'Personalize', icon: PaintBrushRegular },
      { id: 'apps', label: 'Apps', icon: AppsRegular }
    ]
  },
  {
    header: 'Keep it healthy',
    items: [
      { id: 'updates', label: 'Updates', icon: ArrowDownloadRegular },
      { id: 'security', label: 'Security', icon: ShieldCheckmarkRegular },
      { id: 'repair', label: 'Repair', icon: WrenchRegular },
      { id: 'hardware', label: 'Hardware', icon: DesktopPulseRegular }
    ]
  }
]
