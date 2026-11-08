import {
  Battery6Regular,
  ChevronRightRegular,
  DesktopRegular,
  HardDriveRegular,
  KeyboardMouseRegular,
  Speaker2Regular,
  TapSingleRegular,
  UsbPlugRegular,
  XboxControllerRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Card } from '@/components/ui/Card'

// The tests Home offers; each opens a shared hardware page
export const HARDWARE_TESTS = [
  {
    id: 'gamepad',
    title: 'Gamepad',
    text: 'Identify your controller and find out why it misbehaves: drift, dead buttons, triggers, vibration.',
    icon: XboxControllerRegular
  },
  {
    id: 'keyboard',
    title: 'Keyboard & mouse',
    text: 'Press every key and button and see which ones respond.',
    icon: KeyboardMouseRegular
  },
  {
    id: 'display',
    title: 'Screen',
    text: 'Look for dead pixels, bleeding and uneven colours.',
    icon: DesktopRegular
  },
  {
    id: 'touch',
    title: 'Touch',
    text: 'Draw over the whole screen to find spots that don’t respond.',
    icon: TapSingleRegular
  },
  {
    id: 'audio',
    title: 'Sound & camera',
    text: 'Test each speaker, the microphone and the camera.',
    icon: Speaker2Regular
  },
  {
    id: 'battery',
    title: 'Battery',
    text: 'How much charge it holds compared with when it was new.',
    icon: Battery6Regular
  },
  {
    id: 'disk',
    title: 'Drive health',
    text: 'Wear, temperature and errors of your drives.',
    icon: HardDriveRegular
  },
  {
    id: 'ports',
    title: 'USB ports',
    text: 'Plug a device into each port and see which ones work.',
    icon: UsbPlugRegular
  }
]

/** Home's Hardware page: pick a part of the PC to test. */
export function HardwarePage({ onNavigate }) {
  return (
    <Page title="Hardware" description="Check that a part of your PC, or a controller, works.">
      <div className="grid gap-3 sm:grid-cols-2">
        {HARDWARE_TESTS.map(({ id, title, text, icon: Icon }) => (
          <Card key={id} className="p-0">
            <button
              type="button"
              onClick={() => onNavigate(id)}
              className="flex h-full w-full items-center gap-4 rounded-overlay p-5 text-left transition-colors hover:bg-subtle-hover active:bg-subtle-pressed"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-cyan text-brand-carbon">
                <Icon aria-hidden className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-brand text-[17px] font-semibold">{title}</span>
                <span className="block text-text-secondary">{text}</span>
              </span>
              <ChevronRightRegular aria-hidden className="size-4 shrink-0 text-text-secondary" />
            </button>
          </Card>
        ))}
      </div>
    </Page>
  )
}
