// WinDiag website draft. Without this script the page is complete and static;
// the horizontal rows can then be swiped or scrolled sideways.

const root = document.documentElement
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* --- The hero's Checkup runs, as it does in the app ------------------------ */
function runCheckup(delay) {
  const checks = [...document.querySelectorAll('.checks li')]
  const summary = document.querySelector('[data-summary]')
  const detail = document.querySelector('[data-detail]')
  if (!checks.length || !summary || reduced) return
  const final = checks.map((li) => li.dataset.check)
  const finalSummary = summary.textContent
  const finalDetail = detail.textContent
  checks.forEach((li) => (li.dataset.check = 'checking'))
  summary.textContent = 'Checking your PC…'
  detail.textContent = 'This only reads how your PC is doing. Nothing is changed.'
  const order = [6, 3, 0, 4, 2, 7, 5, 1]
  order.forEach((index, step) => {
    setTimeout(
      () => {
        checks[index].dataset.check = final[index]
        if (window.gsap) gsap.fromTo(checks[index], { scale: 0.97 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' })
        if (step === order.length - 1) {
          summary.textContent = finalSummary
          detail.textContent = finalDetail
        }
      },
      delay + step * 380
    )
  })
}

/* --- Press any key ------------------------------------------------------------ */
function setupPress() {
  const press = document.querySelector('.press')
  const bigkey = document.querySelector('.bigkey')
  const legend = document.querySelector('[data-press-legend]')
  const heading = document.querySelector('[data-press-heading]')
  const count = document.querySelector('[data-press-count]')
  const input = document.getElementById('press-input')
  const keys = new Map([...document.querySelectorAll('.kb [data-k]')].map((el) => [el.dataset.k, el]))
  if (!press) return

  const NAMES = {
    ' ': 'Space',
    Spacebar: 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
    Backspace: '⌫',
    Control: 'Ctrl',
    Meta: 'Win',
    OS: 'Win',
    CapsLock: 'Caps',
    Delete: 'Del',
    PageUp: 'PgUp',
    PageDown: 'PgDn',
    Insert: 'Ins',
    ContextMenu: 'Menu',
    AltGraph: 'AltGr'
  }
  const tested = new Set()
  let inView = false

  const label = (event) => NAMES[event.key] ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key)

  function show(name) {
    legend.textContent = name
    legend.classList.toggle('is-long', name.length > 2)
    heading.textContent = `${name} works.`
    press.dataset.state = press.dataset.state === 'a' ? 'b' : 'a'
    bigkey.classList.add('is-down')
    if (window.gsap && !reduced) {
      gsap.fromTo(legend, { yPercent: 18, scale: 0.86 }, { yPercent: 0, scale: 1, duration: 0.45, ease: 'back.out(2.5)' })
      gsap.fromTo(heading, { y: 10, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' })
    }
    const key = keys.get(name)
    if (key) {
      key.classList.add('is-tested', 'is-down')
      setTimeout(() => key.classList.remove('is-down'), 140)
      tested.add(name)
    }
    count.textContent =
      tested.size === keys.size
        ? 'All 27 keys work. In the app, the whole keyboard is tested the same way.'
        : `${tested.size} of ${keys.size} keys tested`
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => (inView = entry.isIntersecting), { threshold: 0.35 }).observe(press)
  }

  window.addEventListener('keydown', (event) => {
    // Only while the section is on screen, and never over a form field
    if (!inView && document.activeElement !== input) return
    if (event.target !== input && event.target.closest?.('input, textarea, select')) return
    if (event.repeat || event.key === 'Tab' || event.metaKey || event.ctrlKey) return
    if ([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key) && inView) event.preventDefault()
    show(label(event))
  })
  window.addEventListener('keyup', () => bigkey.classList.remove('is-down'))

  // On a phone, tapping the big key opens the keyboard (the label focuses the input)
  input?.addEventListener('input', () => {
    const value = input.value
    if (value) show(value.slice(-1) === ' ' ? 'Space' : value.slice(-1).toUpperCase())
    input.value = ''
    setTimeout(() => bigkey.classList.remove('is-down'), 120)
  })
}

/* --- GSAP ------------------------------------------------------------------------- */
function animate() {
  gsap.registerPlugin(ScrollTrigger, SplitText)
  root.classList.add('gsap')

  // Headlines rise line by line out of a mask
  const splits = [...document.querySelectorAll('[data-split]')].map((el) =>
    SplitText.create(el, { type: 'lines,words', linesClass: 'split-line', mask: 'lines' })
  )

  const mm = gsap.matchMedia()

  mm.add(
    { motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' },
    (ctx) => {
      const { reduce } = ctx.conditions
      if (reduce) {
        // Content only, no travel; the rows stay swipeable
        runCheckup(0)
        return
      }

      /* Hero: words rise, then the key opens like a shutter */
      const hero = gsap.timeline({ defaults: { ease: 'expo.out' } })
      hero
        .from(splits[0].words, { yPercent: 110, duration: 1.1, stagger: 0.08 })
        .from('.hero .lead', { y: 24, opacity: 0, duration: 0.8 }, '-=0.7')
        .from('.hero .key', { y: 24, opacity: 0, duration: 0.8 }, '-=0.6')
        .from('.hero .fine', { opacity: 0, duration: 0.6 }, '-=0.5')
        .from('.nav', { y: -20, opacity: 0, duration: 0.8 }, 0)
        .fromTo(
          '.stage',
          { clipPath: 'inset(0% 0% 0% 100% round 88px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 88px)', duration: 1.3, ease: 'expo.inOut' },
          0.15
        )
        .from('.stage .checkup', { scale: 1.12, transformOrigin: 'left top', duration: 1.6 }, 0.15)
      runCheckup(1500)

      // As you leave the hero, the key drifts up and the headline falls behind
      gsap.to('.stage', {
        yPercent: -10,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      })
      gsap.to('.hero-copy', {
        yPercent: 30,
        opacity: 0.2,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      })

      /* Horizontal rows: pin the section and scroll the row sideways */
      const rows = {}
      for (const section of document.querySelectorAll('.hscroll')) {
        const track = section.querySelector('.hscroll-track')
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth)
        rows[section.id] = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            pin: section.querySelector('.hscroll-pin'),
            start: 'top top',
            end: () => `+=${distance()}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
            anticipatePin: 1
          }
        })
      }

      // The wall: keys tumble in from the right and press as they cross the middle
      gsap.utils.toArray('.wall .cap').forEach((cap, i) => {
        gsap.from(cap, {
          yPercent: i % 2 ? 22 : -22,
          rotate: i % 2 ? 6 : -6,
          ease: 'none',
          scrollTrigger: {
            trigger: cap,
            containerAnimation: rows.everything,
            start: 'left right',
            end: 'center 60%',
            scrub: true
          }
        })
        ScrollTrigger.create({
          trigger: cap,
          containerAnimation: rows.everything,
          start: 'left 55%',
          end: 'right 45%',
          toggleClass: 'is-pressed'
        })
      })

      // The app: each screen grows as it reaches the middle, its picture sliding inside
      gsap.utils.toArray('.app .panel').forEach((panel) => {
        gsap.fromTo(
          panel,
          { scale: 0.84, rotate: 2 },
          {
            scale: 1,
            rotate: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: panel,
              containerAnimation: rows.app,
              start: 'left right',
              end: 'center center',
              scrub: true
            }
          }
        )
        gsap.fromTo(
          panel.querySelector('img'),
          { xPercent: 6, scale: 1.12 },
          {
            xPercent: -2,
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: panel,
              containerAnimation: rows.app,
              start: 'left right',
              end: 'right left',
              scrub: true
            }
          }
        )
      })
      gsap.from('.app-intro > *', {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 0.9,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.app', start: 'top 70%' }
      })

      /* Press any key: the big key swings in, the little keyboard types itself in */
      gsap.from('.bigkey', {
        xPercent: 40,
        rotate: 14,
        ease: 'none',
        scrollTrigger: { trigger: '.press', start: 'top bottom', end: 'top 20%', scrub: true }
      })
      gsap.from('.press-copy > *', {
        y: 32,
        opacity: 0,
        stagger: 0.08,
        duration: 0.9,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.press', start: 'top 65%' }
      })
      gsap.from('.kb span', {
        y: -14,
        opacity: 0,
        stagger: { each: 0.025, from: 'random' },
        duration: 0.5,
        ease: 'back.out(3)',
        scrollTrigger: { trigger: '.kb', start: 'top 85%' }
      })

      /* Safety: the picture rises out of the panel, the text follows */
      gsap.fromTo('.safe-pic', { yPercent: 40 }, {
        yPercent: 0,
        ease: 'none',
        scrollTrigger: { trigger: '.safe', start: 'top bottom', end: 'center center', scrub: true }
      })
      gsap.from('.safe-text > *', {
        y: 40,
        opacity: 0,
        stagger: 0.12,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.safe', start: 'top 60%' }
      })

      /* FAQ: the keys drop in one after another */
      gsap.from('.faq details', {
        y: 30,
        opacity: 0,
        stagger: 0.07,
        duration: 0.8,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.faq-list', start: 'top 80%' }
      })

      /* Headlines below the hero rise when they come into view */
      splits.slice(1).forEach((split) => {
        gsap.from(split.words, {
          yPercent: 110,
          duration: 1,
          stagger: 0.06,
          ease: 'expo.out',
          scrollTrigger: { trigger: split.elements[0], start: 'top 85%' }
        })
      })
      gsap.from('.cta-row > *', {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.cta', start: 'top 70%' }
      })

      /* Footer: the logo's key is pressed as the page ends, the name slides in */
      gsap.from('.foot-symbol', {
        yPercent: 40,
        rotate: -8,
        ease: 'none',
        scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true }
      })
      gsap.from('.foot-word', {
        xPercent: -12,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true }
      })
    }
  )

  // Fonts change line breaks and widths: measure again once they are in
  document.fonts?.ready.then(() => ScrollTrigger.refresh())
}

setupPress()
if (window.gsap && window.ScrollTrigger && window.SplitText) animate()
else runCheckup(600)
