import { useEffect, useRef, useState } from 'react'
import {
  ArrowCounterclockwiseRegular,
  CheckmarkCircleFilled,
  ErrorCircleFilled,
  InfoFilled,
  WarningFilled,
  XboxControllerRegular
} from '@fluentui/react-icons'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, ProgressBar } from '@/components/ui/feedback'
import {
  FACE_SYMBOLS,
  RANGE_BINS,
  REST_TEST_MS,
  buttonLabel,
  diagnose,
  identify,
  newSession,
  rangeResult,
  record,
  restResult,
  startRestTest,
  updatesPerSecond
} from '@/lib/gamepad'
import { cn } from '@/lib/utils'

/*
 * Gamepad tester: which controller this is, every button, stick and trigger
 * live, and a diagnosis of why it misbehaves (drift, range, ghost presses,
 * triggers, vibration, disconnects). Reads the browser's Gamepad API, which
 * on Windows covers XInput (Xbox and compatibles) and HID controllers
 * (DualShock 4, DualSense, Switch Pro…).
 */

const padKey = (pad) => `${pad.index}:${pad.id}`

function snapshot(pad) {
  return {
    key: padKey(pad),
    index: pad.index,
    id: pad.id,
    axes: [...pad.axes],
    buttons: pad.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
    info: identify(pad)
  }
}

export function GamepadModule() {
  const sessionsRef = useRef(new Map())
  const [pads, setPads] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)

  useEffect(() => {
    const sessions = sessionsRef.current
    const sessionFor = (pad) => {
      const key = padKey(pad)
      if (!sessions.has(key)) sessions.set(key, newSession())
      return sessions.get(key)
    }
    const onDisconnect = (event) => {
      const session = sessions.get(padKey(event.gamepad))
      if (session) session.disconnects += 1
    }
    window.addEventListener('gamepaddisconnected', onDisconnect)

    let frame
    let shown = 0
    const loop = () => {
      const now = performance.now()
      const list = [...navigator.getGamepads()].filter(Boolean)
      for (const pad of list) record(sessionFor(pad), pad, now)
      // Nothing to redraw while no controller is connected
      if (list.length > 0 || shown > 0) setPads(list.map(snapshot))
      shown = list.length
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])

  const pad = pads.find((p) => p.key === selectedKey) ?? pads[0] ?? null
  const session = pad ? sessionsRef.current.get(pad.key) : null

  const reset = () => {
    if (pad) sessionsRef.current.set(pad.key, newSession())
  }

  return (
    <Page
      title="Gamepad"
      description="Find out which controller you have, and why it isn’t working right."
      actions={
        pad && (
          <Button icon={ArrowCounterclockwiseRegular} onClick={reset}>
            Start over
          </Button>
        )
      }
      className="@container max-w-[1100px]"
    >
      {!pad ? (
        <Waiting />
      ) : (
        <div className="flex flex-col gap-3">
          {pads.length > 1 && <PadTabs pads={pads} selected={pad.key} onSelect={setSelectedKey} />}
          <Identity pad={pad} session={session} />
          {pad.info.standard ? (
            <div className="grid gap-3 @3xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <Card className="flex min-w-0 items-center p-5">
                <ControllerView pad={pad} />
              </Card>
              <Card className="flex min-w-0 flex-col gap-5 p-5">
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1].map((stick) => (
                    <StickPlot key={stick} stick={stick} pad={pad} session={session} />
                  ))}
                </div>
                <Triggers pad={pad} session={session} />
              </Card>
            </div>
          ) : (
            <RawReadings pad={pad} />
          )}
          <ButtonsCard pad={pad} session={session} />
          <div className="grid gap-3 @3xl:grid-cols-2">
            <ChecksCard pad={pad} session={session} />
            <Diagnosis pad={pad} session={session} />
          </div>
        </div>
      )}
    </Page>
  )
}

function Waiting() {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-brand-cyan text-brand-carbon">
        <XboxControllerRegular aria-hidden className="size-11 animate-pulse" />
      </span>
      <div>
        <h2 className="font-brand text-[24px] font-semibold">
          Press any button on your controller
        </h2>
        <p className="mt-1 max-w-[520px] text-text-secondary">
          Windows only shows a controller to an app after a button is pressed, and only while that
          app’s window is in front.
        </p>
      </div>
      <ul className="max-w-[520px] list-disc pl-5 text-left text-text-secondary">
        <li>
          With a cable, try another cable or port if nothing happens: some cables only charge.
        </li>
        <li>
          With Bluetooth, pair it first in Settings &gt; Bluetooth &amp; devices. Xbox: hold the
          pairing button; PlayStation: hold PS + Create (or Share); Switch Pro: hold the sync
          button.
        </li>
        <li>Close Steam or DS4Windows if they are set to take over the controller.</li>
      </ul>
    </Card>
  )
}

function PadTabs({ pads, selected, onSelect }) {
  return (
    <div role="tablist" aria-label="Controllers" className="flex flex-wrap gap-1">
      {pads.map((p) => (
        <button
          key={p.key}
          role="tab"
          type="button"
          aria-selected={p.key === selected}
          onClick={() => onSelect(p.key)}
          className={cn(
            'h-8 rounded-control px-3 text-body',
            p.key === selected
              ? 'bg-subtle-hover font-semibold'
              : 'text-text-secondary hover:bg-subtle-hover'
          )}
        >
          Player {p.index + 1} · {p.info.name}
        </button>
      ))}
    </div>
  )
}

function Identity({ pad, session }) {
  const { info } = pad
  const rate = updatesPerSecond(session)
  const facts = [
    ['Maker', info.maker ?? 'Not recognised'],
    ['Connection', info.connection],
    ['Player', `${pad.index + 1}`],
    ['Layout', info.standard ? 'Standard' : 'Generic'],
    ['Vibration', info.triggerRumble ? 'Yes, with triggers' : info.rumble ? 'Yes' : 'No'],
    [
      'Hardware ID',
      info.vendorId ? `${info.vendorId.toUpperCase()}:${info.productId.toUpperCase()}` : 'Hidden'
    ],
    ['Updates', rate > 0 ? `${rate} per second` : 'Idle']
  ]
  return (
    <Card className="grid overflow-hidden @3xl:grid-cols-[200px_1fr]">
      <div className="grid place-items-center bg-brand-cyan px-6 py-6 text-brand-carbon">
        <XboxControllerRegular aria-hidden className="size-20" />
      </div>
      <div className="flex min-w-0 flex-col gap-3 px-6 py-5">
        <div className="min-w-0">
          <p className="text-text-secondary">{info.maker ?? 'Controller'}</p>
          <h2 className="selectable font-brand text-[30px] leading-[1.15] font-semibold tracking-[-0.01em]">
            {info.name}
          </h2>
          {info.name !== info.reported && (
            <p className="selectable text-caption text-text-secondary">
              Windows calls it “{info.reported}”
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-2 @lg:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-caption text-text-secondary">{label}</dt>
              <dd className="selectable truncate font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {info.connection === 'XInput' && (
          <p className="text-caption text-text-secondary">
            XInput hides the exact model, so Windows shows every Xbox-compatible controller the same
            way.
          </p>
        )}
      </div>
    </Card>
  )
}

/* --- The controller drawing ---------------------------------------------- */

const LAYOUTS = {
  // Xbox, Switch Pro and most PC controllers: left stick on top
  offset: { ls: [135, 118], dpad: [190, 188], face: [345, 118], rs: [290, 188] },
  // PlayStation: d-pad on top, both sticks below
  playstation: { ls: [190, 190], dpad: [135, 118], face: [345, 118], rs: [290, 190] }
}

function ControllerView({ pad }) {
  const { family } = pad.info
  const layout = family === 'playstation' ? LAYOUTS.playstation : LAYOUTS.offset
  const b = pad.buttons
  const value = (i) => b[i]?.value ?? 0
  const on = (i) => Boolean(b[i]?.pressed) || value(i) > 0.5
  const symbols = FACE_SYMBOLS[family] ?? FACE_SYMBOLS.generic
  const [fx, fy] = layout.face
  const [dx, dy] = layout.dpad

  return (
    <svg
      viewBox="0 0 480 300"
      role="img"
      aria-label={`${pad.info.name}: live view of its buttons and sticks`}
      className="w-full"
    >
      {/* Triggers and bumpers */}
      <Analog x={95} y={4} w={70} h={18} value={value(6)} label={buttonLabel(family, 6)} />
      <Analog x={315} y={4} w={70} h={18} value={value(7)} label={buttonLabel(family, 7)} />
      <Key shape="rect" x={78} y={28} w={104} h={16} on={on(4)} label={buttonLabel(family, 4)} />
      <Key shape="rect" x={298} y={28} w={104} h={16} on={on(5)} label={buttonLabel(family, 5)} />

      <path
        d="M120 48H360C418 48 448 76 460 134L476 222C484 262 461 290 430 288C406 286 391 271 373 246L351 216H129L107 246C89 271 74 286 50 288C19 290-4 262 4 222L20 134C32 76 62 48 120 48Z"
        className="fill-control stroke-text-secondary/40"
        strokeWidth="1.5"
      />

      {/* D-pad */}
      <Key shape="rect" x={dx - 11} y={dy - 36} w={22} h={25} on={on(12)} />
      <Key shape="rect" x={dx - 11} y={dy + 11} w={22} h={25} on={on(13)} />
      <Key shape="rect" x={dx - 36} y={dy - 11} w={25} h={22} on={on(14)} />
      <Key shape="rect" x={dx + 11} y={dy - 11} w={25} h={22} on={on(15)} />

      {/* Face buttons: bottom, right, left, top */}
      {[
        [fx, fy + 29],
        [fx + 29, fy],
        [fx - 29, fy],
        [fx, fy - 29]
      ].map(([cx, cy], i) => (
        <Key key={i} shape="circle" cx={cx} cy={cy} r={14} on={on(i)} text={symbols[i]} />
      ))}

      {/* Select, start, home and the extra button */}
      {family === 'playstation' ? (
        <>
          <Key shape="rect" x={196} y={62} w={88} h={52} on={on(17)} text="" rx={10} />
          <Key shape="rect" x={168} y={66} w={14} h={22} on={on(8)} rx={5} />
          <Key shape="rect" x={298} y={66} w={14} h={22} on={on(9)} rx={5} />
          <Key shape="circle" cx={240} cy={158} r={11} on={on(16)} />
        </>
      ) : (
        <>
          <Key shape="circle" cx={208} cy={118} r={9} on={on(8)} />
          <Key shape="circle" cx={272} cy={118} r={9} on={on(9)} />
          <Key shape="circle" cx={240} cy={84} r={14} on={on(16)} />
          {b.length > 17 && <Key shape="rect" x={233} y={140} w={14} h={9} on={on(17)} rx={3} />}
        </>
      )}

      {/* Sticks */}
      <Stick c={layout.ls} x={pad.axes[0]} y={pad.axes[1]} click={on(10)} />
      <Stick c={layout.rs} x={pad.axes[2]} y={pad.axes[3]} click={on(11)} />
    </svg>
  )
}

function Key({ shape, on, text, label, rx = 5, ...geometry }) {
  const fill = on ? 'fill-accent-fill' : 'fill-card'
  const textFill = on ? 'fill-text-on-accent' : 'fill-text-primary'
  if (shape === 'circle') {
    const { cx, cy, r } = geometry
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} className={cn(fill, 'stroke-text-secondary/50')} />
        {text && (
          <text
            x={cx}
            y={cy}
            dy="0.35em"
            textAnchor="middle"
            className={cn(textFill, 'text-[13px] font-semibold')}
          >
            {text}
          </text>
        )}
      </g>
    )
  }
  const { x, y, w, h } = geometry
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        className={cn(fill, 'stroke-text-secondary/50')}
      />
      {(text || label) && (
        <text
          x={x + w / 2}
          y={y + h / 2}
          dy="0.35em"
          textAnchor="middle"
          className={cn(textFill, 'text-[10px] font-semibold')}
        >
          {text ?? label}
        </text>
      )}
    </g>
  )
}

function Analog({ x, y, w, h, value, label }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        className="fill-card stroke-text-secondary/50"
      />
      <rect
        x={x}
        y={y}
        width={w * value}
        height={h}
        rx={6}
        className="fill-accent-fill"
        opacity={value > 0.02 ? 1 : 0}
      />
      <text
        x={x + w / 2}
        y={y + h / 2}
        dy="0.35em"
        textAnchor="middle"
        className="fill-text-primary text-[10px] font-semibold"
      >
        {label}
      </text>
    </g>
  )
}

function Stick({ c: [cx, cy], x = 0, y = 0, click }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={32} className="fill-card stroke-text-secondary/50" />
      <circle
        cx={cx + x * 13}
        cy={cy + y * 13}
        r={20}
        className={cn(click ? 'fill-accent-fill' : 'fill-control', 'stroke-text-secondary/60')}
        strokeWidth="1.5"
      />
    </g>
  )
}

function Triggers({ pad, session }) {
  const { family } = pad.info
  return (
    <div className="grid grid-cols-2 gap-4">
      {[6, 7].map((index, i) => (
        <div key={index} className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{buttonLabel(family, index)}</span>
            <span className="font-brand tabular-nums">
              {Math.round((pad.buttons[index]?.value ?? 0) * 100)} %
            </span>
          </div>
          <ProgressBar
            value={(pad.buttons[index]?.value ?? 0) * 100}
            label={buttonLabel(family, index)}
          />
          <p className="mt-1 text-caption text-text-secondary">
            Highest: {Math.round(session.triggerMax[i] * 100)} %
          </p>
        </div>
      ))}
    </div>
  )
}

/* --- Sticks --------------------------------------------------------------- */

const PLOT = 168

function StickPlot({ stick, pad, session }) {
  const canvasRef = useRef(null)
  const x = pad.axes[stick * 2] ?? 0
  const y = pad.axes[stick * 2 + 1] ?? 0
  const range = rangeResult(session, stick)
  const rest = restResult(session)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== PLOT * dpr) {
      canvas.width = PLOT * dpr
      canvas.height = PLOT * dpr
    }
    const ctx = canvas.getContext('2d')
    const accent = getComputedStyle(canvas).color
    const c = PLOT / 2
    const unit = PLOT / 2 - 14
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, PLOT, PLOT)

    // The edge, the centre lines and a 10 % dead zone
    ctx.strokeStyle = 'rgb(128 128 128 / 0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(c, c, unit, 0, Math.PI * 2)
    ctx.moveTo(c - unit, c)
    ctx.lineTo(c + unit, c)
    ctx.moveTo(c, c - unit)
    ctx.lineTo(c, c + unit)
    ctx.stroke()
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(c, c, unit * 0.1, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // How far it has reached in each direction
    const reach = session.reach[stick]
    if (reach.some((r) => r > 0)) {
      ctx.beginPath()
      reach.forEach((r, bin) => {
        const angle = ((bin + 0.5) / RANGE_BINS) * Math.PI * 2
        const px = c + Math.cos(angle) * r * unit
        const py = c + Math.sin(angle) * r * unit
        if (bin === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.closePath()
      ctx.fillStyle = accent
      ctx.globalAlpha = 0.18
      ctx.fill()
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Where it is now
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(c + x * unit, c + y * unit, 6, 0, Math.PI * 2)
    ctx.fill()
  })

  const drift = rest?.drift[stick]
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div className="flex w-full flex-wrap items-baseline justify-between gap-x-2">
        <h3 className="font-semibold">{stick === 0 ? 'Left stick' : 'Right stick'}</h3>
        <span className="font-brand text-caption tabular-nums text-text-secondary">
          X {x.toFixed(2)} · Y {y.toFixed(2)}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: PLOT, height: PLOT }}
        className="text-accent-fill"
        aria-label={`${stick === 0 ? 'Left' : 'Right'} stick position and range`}
        role="img"
      />
      <dl className="grid w-full grid-cols-2 gap-x-3 text-caption">
        <dt className="text-text-secondary">Range</dt>
        <dd className="text-right tabular-nums">
          {range.complete
            ? `${Math.round(range.averageError * 100)} % short`
            : `${Math.round(range.coverage * 100)} % traced`}
        </dd>
        <dt className="text-text-secondary">At rest</dt>
        <dd className="text-right tabular-nums">
          {drift === undefined ? 'Not checked' : `${Math.round(drift * 100)} % off`}
        </dd>
      </dl>
    </div>
  )
}

/* --- Buttons -------------------------------------------------------------- */

function ButtonsCard({ pad, session }) {
  const { family } = pad.info
  const tested = pad.buttons.filter((_, i) => session.pressed.has(i)).length
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-brand text-subtitle font-semibold">Buttons</h2>
        <span className="text-text-secondary tabular-nums">
          {tested} of {pad.buttons.length} pressed · press each one once
        </span>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1.5">
        {pad.buttons.map((button, i) => {
          const now = button.pressed || button.value > 0.5
          const done = session.pressed.has(i)
          return (
            <li
              key={i}
              className={cn(
                'flex h-9 items-center justify-between gap-2 rounded-control border px-2.5 text-body',
                now
                  ? 'border-transparent bg-accent-fill text-text-on-accent'
                  : done
                    ? 'border-success/40 bg-success-bg text-success'
                    : 'border-control-stroke bg-control text-text-secondary'
              )}
            >
              <span className="truncate font-semibold">
                {pad.info.standard ? buttonLabel(family, i) : `Button ${i + 1}`}
              </span>
              {button.value > 0 && button.value < 1 ? (
                <span className="text-caption tabular-nums">{Math.round(button.value * 100)}%</span>
              ) : (
                done &&
                !now && <CheckmarkCircleFilled aria-label="Works" className="size-4 shrink-0" />
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function RawReadings({ pad }) {
  return (
    <Card className="p-5">
      <h2 className="font-brand text-subtitle font-semibold">Axes</h2>
      <p className="mb-3 text-text-secondary">
        Windows doesn’t know this controller’s layout, so here are its raw readings.
      </p>
      <div className="grid gap-3 @lg:grid-cols-2">
        {pad.axes.map((value, i) => (
          <div key={i}>
            <div className="flex justify-between text-caption">
              <span>Axis {i + 1}</span>
              <span className="tabular-nums">{value.toFixed(2)}</span>
            </div>
            <ProgressBar value={((value + 1) / 2) * 100} label={`Axis ${i + 1}`} />
          </div>
        ))}
      </div>
    </Card>
  )
}

/* --- Checks and diagnosis ------------------------------------------------- */

function ChecksCard({ pad, session }) {
  const rest = session.restTest
  const running = rest && !rest.done
  const elapsed = running ? Math.min(1, (performance.now() - rest.startedAt) / REST_TEST_MS) : 0

  const rumble = async (kind) => {
    const actuator = navigator.getGamepads()[pad.index]?.vibrationActuator
    if (!actuator) return
    try {
      if (kind === 'triggers')
        await actuator.playEffect('trigger-rumble', {
          duration: 800,
          leftTrigger: 1,
          rightTrigger: 1
        })
      else
        await actuator.playEffect('dual-rumble', {
          duration: 800,
          strongMagnitude: kind === 'strong' ? 1 : 0,
          weakMagnitude: kind === 'weak' ? 1 : 0
        })
    } catch {
      // The controller refused the effect: the person reports what they felt
    }
  }

  return (
    <Card className="flex min-w-0 flex-col gap-5 p-5">
      <h2 className="font-brand text-subtitle font-semibold">Checks</h2>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">1. Drift and stuck buttons</h3>
        <p className="text-text-secondary">
          Put the controller down and don’t touch it for 3 seconds. WinDiag measures where the
          sticks rest and whether anything presses by itself.
        </p>
        {running ? (
          <ProgressBar value={elapsed * 100} label="Measuring" />
        ) : (
          <div>
            <Button variant="accent" onClick={() => startRestTest(session, performance.now())}>
              {rest?.done ? 'Check again' : 'Check for drift'}
            </Button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">2. Stick range</h3>
        <p className="text-text-secondary">
          Roll each stick slowly round its edge a few times. The shape it draws should fill the
          circle.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">3. Vibration</h3>
        {pad.info.rumble ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => rumble('strong')}>Left motor</Button>
              <Button onClick={() => rumble('weak')}>Right motor</Button>
              {pad.info.triggerRumble && (
                <Button onClick={() => rumble('triggers')}>Trigger motors</Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-secondary">Did each one vibrate?</span>
              <Button
                variant={session.rumbleFelt === true ? 'accent' : 'standard'}
                onClick={() => (session.rumbleFelt = session.rumbleFelt === true ? null : true)}
              >
                Yes
              </Button>
              <Button
                variant={session.rumbleFelt === false ? 'accent' : 'standard'}
                onClick={() => (session.rumbleFelt = session.rumbleFelt === false ? null : false)}
              >
                No
              </Button>
            </div>
          </>
        ) : (
          <p className="text-text-secondary">
            Windows doesn’t offer vibration for this controller in this connection mode.
          </p>
        )}
      </section>
    </Card>
  )
}

const FINDING_STYLE = {
  attention: {
    icon: ErrorCircleFilled,
    color: 'text-critical',
    label: 'Needs attention',
    tone: 'critical'
  },
  look: { icon: WarningFilled, color: 'text-caution', label: 'Worth a look', tone: 'caution' },
  info: { icon: InfoFilled, color: 'text-accent-text', label: 'To do', tone: 'neutral' }
}

function Diagnosis({ pad, session }) {
  const findings = diagnose(pad.info, session, pad.buttons.length)
  const checked = session.restTest?.done
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <h2 className="font-brand text-subtitle font-semibold">What we found</h2>
      {findings.length === 0 ? (
        <p className="flex items-start gap-2">
          <CheckmarkCircleFilled aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            {checked
              ? 'No faults found. Every button responds and the sticks rest in the centre.'
              : 'Nothing wrong so far. Run the checks to look for drift and stuck buttons.'}
          </span>
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {findings.map((finding) => {
            const style = FINDING_STYLE[finding.status] ?? FINDING_STYLE.info
            const Icon = style.icon
            return (
              <li key={finding.title} className="flex gap-3">
                <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', style.color)} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {finding.title}
                    <Badge tone={style.tone}>{style.label}</Badge>
                  </p>
                  <p className="mt-1 text-text-secondary">
                    <span className="font-semibold text-text-primary">Why: </span>
                    {finding.cause}
                  </p>
                  <p className="mt-1 text-text-secondary">
                    <span className="font-semibold text-text-primary">Try: </span>
                    {finding.fix}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
