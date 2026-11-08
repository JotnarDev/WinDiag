/*
 * Gamepad tester logic: which controller this is, and what its readings say
 * about why it misbehaves. No React here; the page feeds it snapshots.
 *
 * Indices follow the W3C "standard" mapping, which Chromium uses for every
 * controller it recognises (XInput, DualShock 4, DualSense, Switch Pro…):
 * buttons 0–3 face (bottom, right, left, top), 4–5 bumpers, 6–7 triggers,
 * 8 select, 9 start, 10–11 stick clicks, 12–15 d-pad, 16 home, 17 extra;
 * axes 0–1 left stick, 2–3 right stick.
 */

const LABELS = {
  xbox: [
    'A',
    'B',
    'X',
    'Y',
    'LB',
    'RB',
    'LT',
    'RT',
    'View',
    'Menu',
    'LS',
    'RS',
    'Up',
    'Down',
    'Left',
    'Right',
    'Xbox',
    'Share'
  ],
  playstation: [
    'Cross',
    'Circle',
    'Square',
    'Triangle',
    'L1',
    'R1',
    'L2',
    'R2',
    'Create',
    'Options',
    'L3',
    'R3',
    'Up',
    'Down',
    'Left',
    'Right',
    'PS',
    'Touchpad'
  ],
  // Nintendo's bottom button is B and its right button is A
  nintendo: [
    'B',
    'A',
    'Y',
    'X',
    'L',
    'R',
    'ZL',
    'ZR',
    'Minus',
    'Plus',
    'LS',
    'RS',
    'Up',
    'Down',
    'Left',
    'Right',
    'Home',
    'Capture'
  ],
  generic: [
    'Bottom',
    'Right',
    'Left',
    'Top',
    'Left bumper',
    'Right bumper',
    'Left trigger',
    'Right trigger',
    'Select',
    'Start',
    'Left stick',
    'Right stick',
    'Up',
    'Down',
    'Left',
    'Right',
    'Home',
    'Extra'
  ]
}

/** Short symbols drawn on the face buttons. */
export const FACE_SYMBOLS = {
  xbox: ['A', 'B', 'X', 'Y'],
  playstation: ['✕', '○', '□', '△'],
  nintendo: ['B', 'A', 'Y', 'X'],
  generic: ['1', '2', '3', '4']
}

const MAKERS = {
  '045e': { maker: 'Microsoft', family: 'xbox' },
  '054c': { maker: 'Sony', family: 'playstation' },
  '057e': { maker: 'Nintendo', family: 'nintendo' },
  '046d': { maker: 'Logitech', family: 'xbox' },
  '2dc8': { maker: '8BitDo', family: 'generic' },
  '28de': { maker: 'Valve', family: 'xbox' },
  '0f0d': { maker: 'Hori', family: 'generic' },
  '0e6f': { maker: 'PDP', family: 'xbox' },
  '24c6': { maker: 'PowerA', family: 'xbox' },
  1532: { maker: 'Razer', family: 'xbox' },
  '0738': { maker: 'Mad Catz', family: 'xbox' },
  2563: { maker: 'ShanWan', family: 'generic' },
  '20d6': { maker: 'PowerA', family: 'nintendo' },
  '18d1': { maker: 'Google', family: 'xbox' }
}

// vendor:product → the name people know it by
const MODELS = {
  '045e:028e': 'Xbox 360 Controller',
  '045e:028f': 'Xbox 360 Wireless Controller',
  '045e:0719': 'Xbox 360 Wireless Receiver',
  '045e:02d1': 'Xbox One Controller',
  '045e:02dd': 'Xbox One Controller',
  '045e:02e0': 'Xbox One S Controller (Bluetooth)',
  '045e:02ea': 'Xbox One S Controller',
  '045e:02fd': 'Xbox One S Controller (Bluetooth)',
  '045e:02e3': 'Xbox Elite Controller',
  '045e:0b00': 'Xbox Elite Controller Series 2',
  '045e:0b05': 'Xbox Elite Controller Series 2 (Bluetooth)',
  '045e:0b22': 'Xbox Elite Controller Series 2 (Bluetooth)',
  '045e:0b12': 'Xbox Series X|S Controller',
  '045e:0b13': 'Xbox Series X|S Controller (Bluetooth)',
  '045e:0b20': 'Xbox Series X|S Controller (Bluetooth)',
  '045e:0b21': 'Xbox Adaptive Controller (Bluetooth)',
  '045e:0b0a': 'Xbox Adaptive Controller',
  '054c:0268': 'DualShock 3',
  '054c:05c4': 'DualShock 4 (first model)',
  '054c:09cc': 'DualShock 4',
  '054c:0ba0': 'DualShock 4 USB Wireless Adapter',
  '054c:0ce6': 'DualSense',
  '054c:0df2': 'DualSense Edge',
  '057e:2009': 'Switch Pro Controller',
  '057e:2006': 'Joy-Con (L)',
  '057e:2007': 'Joy-Con (R)',
  '057e:200e': 'Joy-Con Charging Grip',
  '046d:c21d': 'Logitech F310',
  '046d:c21e': 'Logitech F510',
  '046d:c21f': 'Logitech F710',
  '046d:c216': 'Logitech F310 (DirectInput mode)',
  '046d:c219': 'Logitech F710 (DirectInput mode)',
  '28de:1102': 'Steam Controller',
  '28de:1142': 'Steam Controller (wireless)',
  '28de:1205': 'Steam Deck',
  '18d1:9400': 'Stadia Controller'
}

/** What this controller is, from the id string Chromium gives it. */
export function identify(pad) {
  const id = pad.id ?? ''
  const ids = id.match(/Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})/i)
  const vendorId = ids?.[1].toLowerCase() ?? null
  const productId = ids?.[2].toLowerCase() ?? null
  const xinput = /xinput/i.test(id)
  const reported = id.replace(/\s*\(.*\)\s*$/, '').trim() || 'Unknown controller'
  const known = vendorId ? MAKERS[vendorId] : null
  const model = vendorId && productId ? MODELS[`${vendorId}:${productId}`] : null

  let family = known?.family ?? 'generic'
  if (xinput) family = 'xbox'
  else if (/dualsense|dualshock|wireless controller/i.test(reported) && !known)
    family = 'playstation'
  else if (/pro controller|joy-con/i.test(reported) && !known) family = 'nintendo'

  // XInput hides which controller it is: anything Xbox-compatible looks alike
  const name = model ?? (xinput ? 'Xbox-compatible controller' : reported)
  const effects = pad.vibrationActuator?.effects ?? []
  return {
    name,
    reported,
    maker: known?.maker ?? null,
    family,
    vendorId,
    productId,
    connection: xinput ? 'XInput' : vendorId ? 'HID' : 'Unknown',
    standard: pad.mapping === 'standard',
    rumble: Boolean(pad.vibrationActuator),
    triggerRumble: effects.includes('trigger-rumble'),
    buttonCount: pad.buttons.length,
    axisCount: pad.axes.length
  }
}

export function buttonLabel(family, index) {
  return LABELS[family]?.[index] ?? LABELS.generic[index] ?? `Button ${index + 1}`
}

/* --- Measurements --------------------------------------------------------- */

export const RANGE_BINS = 36

/** Everything measured for one controller while the page is open. */
export function newSession() {
  return {
    pressed: new Set(),
    triggerMax: [0, 0],
    // Furthest each stick reached, per 10° direction
    reach: [new Array(RANGE_BINS).fill(0), new Array(RANGE_BINS).fill(0)],
    updates: [],
    disconnects: 0,
    lastTimestamp: null,
    restTest: null,
    // What the person felt when the controller vibrated: true, false or null
    rumbleFelt: null
  }
}

const TRIGGERS = [6, 7]

/** Takes in one reading of the controller. */
export function record(session, pad, now) {
  pad.buttons.forEach((button, index) => {
    if (button.pressed || button.value > 0.5) session.pressed.add(index)
  })
  TRIGGERS.forEach((index, i) => {
    const value = pad.buttons[index]?.value ?? 0
    if (value > session.triggerMax[i]) session.triggerMax[i] = value
  })
  for (let stick = 0; stick < 2; stick++) {
    const x = pad.axes[stick * 2] ?? 0
    const y = pad.axes[stick * 2 + 1] ?? 0
    const r = Math.hypot(x, y)
    if (r > 0.3) {
      const angle = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI)
      const bin = Math.floor((angle / (2 * Math.PI)) * RANGE_BINS) % RANGE_BINS
      if (r > session.reach[stick][bin]) session.reach[stick][bin] = r
    }
  }
  // New readings per second: how often the controller sends a changed state
  if (pad.timestamp !== session.lastTimestamp) {
    session.lastTimestamp = pad.timestamp
    session.updates.push(now)
  }
  while (session.updates.length && now - session.updates[0] > 1000) session.updates.shift()

  const rest = session.restTest
  if (rest && !rest.done) {
    for (let stick = 0; stick < 2; stick++) {
      const x = pad.axes[stick * 2] ?? 0
      const y = pad.axes[stick * 2 + 1] ?? 0
      rest.sum[stick][0] += x
      rest.sum[stick][1] += y
      rest.peak[stick] = Math.max(rest.peak[stick], Math.hypot(x, y))
    }
    rest.samples += 1
    TRIGGERS.forEach((index, i) => {
      rest.triggerPeak[i] = Math.max(rest.triggerPeak[i], pad.buttons[index]?.value ?? 0)
    })
    pad.buttons.forEach((button, index) => {
      if (!TRIGGERS.includes(index) && (button.pressed || button.value > 0.5))
        rest.ghosts.add(index)
    })
    if (now - rest.startedAt >= REST_TEST_MS) rest.done = true
  }
}

export const REST_TEST_MS = 3000

/** Starts the "let go of the controller" test. */
export function startRestTest(session, now) {
  session.restTest = {
    startedAt: now,
    samples: 0,
    sum: [
      [0, 0],
      [0, 0]
    ],
    peak: [0, 0],
    triggerPeak: [0, 0],
    ghosts: new Set(),
    done: false
  }
}

/** Where each stick sits when nobody touches it: drift. */
export function restResult(session) {
  const rest = session.restTest
  if (!rest?.done || rest.samples === 0) return null
  return {
    drift: rest.sum.map(([x, y]) => Math.hypot(x / rest.samples, y / rest.samples)),
    peak: rest.peak,
    triggerPeak: rest.triggerPeak,
    ghosts: [...rest.ghosts]
  }
}

/** How much of the edge a stick has been taken round, and how short it falls. */
export function rangeResult(session, stick) {
  const reach = session.reach[stick]
  const visited = reach.filter((r) => r > 0.5)
  const coverage = visited.length / RANGE_BINS
  if (coverage < 0.9) return { coverage, complete: false }
  // Sticks with a square gate go past 1 at the diagonals: only falling short counts
  const shortfalls = reach.map((r) => Math.max(0, 1 - Math.min(r, 1)))
  const average = shortfalls.reduce((a, b) => a + b, 0) / RANGE_BINS
  const worstBin = shortfalls.indexOf(Math.max(...shortfalls))
  return {
    coverage,
    complete: true,
    averageError: average,
    worst: shortfalls[worstBin],
    worstDirection: directionName((worstBin + 0.5) * (360 / RANGE_BINS))
  }
}

function directionName(degrees) {
  // Screen coordinates: y grows downwards, so 90° is down
  const names = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right']
  return names[Math.round(degrees / 45) % 8]
}

export function updatesPerSecond(session) {
  return session.updates.length
}

/* --- Diagnosis ------------------------------------------------------------ */

const STICK_NAMES = ['Left stick', 'Right stick']
const TRIGGER_NAMES = ['Left trigger', 'Right trigger']

/**
 * What the measurements say, worst first. Each finding has a status (good,
 * look, attention), a title, the likely cause and what to try.
 */
export function diagnose(info, session, buttonCount) {
  const findings = []
  const rest = restResult(session)

  if (!info.standard) {
    findings.push({
      status: 'look',
      title: 'Windows sees this as a generic controller',
      cause:
        'Games and Windows don’t know its layout, so buttons may be swapped or missing in games.',
      fix: 'Turn on Steam Input for it in Steam (Settings > Controller), or install the maker’s app. Many controllers also have an XInput mode, often chosen by holding a button while connecting.'
    })
  }

  if (rest) {
    rest.drift.forEach((drift, stick) => {
      const amount = `${Math.round(drift * 100)} %`
      if (drift > 0.12)
        findings.push({
          status: 'attention',
          title: `${STICK_NAMES[stick]} drifts (${amount} off centre at rest)`,
          cause:
            'Dust or wear inside the stick’s sensor makes it report movement when nobody touches it. This is the most common controller fault.',
          fix: 'Blow compressed air around the base of the stick while moving it in circles. If it comes back, the stick module needs replacing (Hall effect sticks don’t wear this way). Until then, raise the dead zone in the game’s settings.'
        })
      else if (drift > 0.05)
        findings.push({
          status: 'look',
          title: `${STICK_NAMES[stick]} rests slightly off centre (${amount})`,
          cause: 'Early wear or dust. Most games ignore this much with their default dead zone.',
          fix: 'Clean around the stick with compressed air. Keep an eye on it: if it grows, it becomes drift.'
        })
    })
    rest.triggerPeak.forEach((peak, i) => {
      if (peak > 0.08)
        findings.push({
          status: 'attention',
          title: `${TRIGGER_NAMES[i]} doesn’t return to rest (${Math.round(peak * 100)} % when released)`,
          cause: 'A weak return spring or dirt keeps the trigger partly pressed.',
          fix: 'Press it firmly a few times and clean around it. If it stays, the trigger spring needs replacing.'
        })
    })
    if (rest.ghosts.length > 0)
      findings.push({
        status: 'attention',
        title: `Pressed by itself: ${rest.ghosts.map((b) => buttonLabel(info.family, b)).join(', ')}`,
        cause:
          'A stuck button, liquid or dirt under it, or a damaged contact makes it register without being touched.',
        fix: 'Check that the button moves freely and clean around it. If it keeps triggering, the contact under it needs repair.'
      })
  }

  for (let stick = 0; stick < 2; stick++) {
    const range = rangeResult(session, stick)
    if (range.complete && range.worst > 0.15)
      findings.push({
        status: 'look',
        title: `${STICK_NAMES[stick]} doesn’t reach the edge towards ${range.worstDirection}`,
        cause:
          'Wear or dirt in the stick, or something blocking its movement, cuts its range in that direction.',
        fix: 'Clean around the stick. In games this shows as not reaching full speed in that direction.'
      })
  }

  session.triggerMax.forEach((max, i) => {
    if (max > 0.2 && max < 0.9)
      findings.push({
        status: 'look',
        title: `${TRIGGER_NAMES[i]} only reaches ${Math.round(max * 100)} %`,
        cause:
          'If you pressed it all the way, a trigger stop (on Elite and some pro controllers) or wear keeps it short of full travel.',
        fix: 'Check for trigger stop switches on the back and set them to full travel.'
      })
  })

  if (session.rumbleFelt === false)
    findings.push({
      status: 'attention',
      title: 'Vibration doesn’t work',
      cause: info.rumble
        ? 'A loose or broken vibration motor, or vibration turned off in the Xbox Accessories app, Steam or the maker’s app.'
        : 'Windows doesn’t offer vibration for this controller in this connection mode.',
      fix: 'Check that vibration is on in the controller’s app. If it still doesn’t vibrate, a motor needs repair.'
    })

  if (session.disconnects > 0)
    findings.push({
      status: 'attention',
      title: `Disconnected ${session.disconnects === 1 ? 'once' : `${session.disconnects} times`} while testing`,
      cause: 'A low battery, a worn cable or port, or Bluetooth interference.',
      fix: 'Charge it or try a different cable. On Bluetooth, move closer to the PC and away from Wi-Fi routers and USB 3 ports, or use the maker’s wireless adapter.'
    })

  const tested = session.pressed.size
  if (tested > 0 && tested < buttonCount)
    findings.push({
      status: 'info',
      title: `${buttonCount - tested} ${buttonCount - tested === 1 ? 'button hasn’t' : 'buttons haven’t'} been pressed yet`,
      cause: 'A button that never lights up when pressed has a dirty or worn contact.',
      fix: 'Press every button once. Those that don’t light up are the ones to clean or repair.'
    })

  const order = { attention: 0, look: 1, info: 2, good: 3 }
  return findings.sort((a, b) => order[a.status] - order[b.status])
}
