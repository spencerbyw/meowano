import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { onMicLevel } from '../audio/mic'
import styles from './PeekCat.module.css'

/**
 * Kiano's cat, alive: peeking over the top of a card with its paws on the edge
 * (or just its head, for the logo). It reacts to `mood`, follows taps with its
 * eyes, blinks, twitches its ears, and if nothing happens for a while, yawns and
 * dozes off until the next tap.
 *
 * Drawn in the same 64-unit space as the logo's CatMark, so it's the same cat.
 */

export type PeekMood =
  'idle' | 'happy' | 'love' | 'sad' | 'confused' | 'curious' | 'listening'

type Face = PeekMood | 'purr' | 'yawn' | 'asleep' | 'startled'

interface PeekCatProps {
  mood?: PeekMood
  /** 'peek' sits on a card's top edge (place it with position: relative parent). */
  variant?: 'peek' | 'head'
  /** Change it to replay the mood's reaction (e.g. each wrong answer). */
  beat?: string | number
  /** Change it to have the cat duck down and pop up again (each new question). */
  peek?: string | number
  /** Right answers in a row: sparkles from 3. */
  streak?: number
  /** Prick up the ears at what the microphone hears. */
  hearMic?: boolean
  /** Yawn, then nap, when left alone. */
  sleepy?: boolean
  onPet?: () => void
  petLabel?: string
  className?: string
  style?: CSSProperties
}

const YAWN_AFTER_MS = 20_000
const SLEEP_AFTER_MS = 45_000
const PET_MS = 1600
/** Pets closer together than this count as one petting session… */
const PET_GAP_MS = 1200
/** …and this many in a row earn heart eyes (the start screen's confetti, too). */
const PETS_FOR_LOVE = 5
/** Look back down at the music this long after the last tap. */
const LOOK_HOLD_MS = 2500

const OPEN_EYES: Face[] = ['idle', 'curious', 'sad', 'confused']

export function PeekCat({
  mood = 'idle',
  variant = 'peek',
  beat,
  peek,
  streak = 0,
  hearMic,
  sleepy,
  onPet,
  petLabel,
  className,
  style,
}: PeekCatProps) {
  const root = useRef<HTMLElement>(null)
  const clip = `peek${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [rest, setRest] = useState<'awake' | 'yawn' | 'asleep' | 'startled'>('awake')
  const [petting, setPetting] = useState(0)
  const [loved, setLoved] = useState(false)
  const pets = useRef({ count: 0, last: 0 })
  const [blink, setBlink] = useState(false)
  const [twitch, setTwitch] = useState<'L' | 'R' | null>(null)
  const wake = useRef(() => {})

  const face: Face = petting
    ? loved
      ? 'love'
      : 'purr'
    : rest === 'startled'
      ? 'startled'
      : rest !== 'awake' && mood !== 'listening' && mood !== 'curious'
        ? rest
        : mood

  // Dozing off when left alone; any tap (or a change of mood) wakes it.
  useEffect(() => {
    if (!sleepy) return
    let state: typeof rest = 'awake'
    const timers: number[] = []
    const set = (s: typeof rest) => {
      state = s
      setRest(s)
    }
    const arm = () => {
      timers.splice(0).forEach((id) => window.clearTimeout(id))
      timers.push(
        window.setTimeout(() => {
          set('yawn')
          timers.push(window.setTimeout(() => state === 'yawn' && set('awake'), 2400))
        }, YAWN_AFTER_MS),
        window.setTimeout(() => set('asleep'), SLEEP_AFTER_MS),
      )
    }
    wake.current = () => {
      if (state === 'asleep') {
        set('startled')
        arm()
        timers.push(window.setTimeout(() => set('awake'), 700))
        return
      }
      if (state === 'yawn') set('awake')
      arm()
    }
    const onInput = () => wake.current()
    window.addEventListener('pointerdown', onInput)
    window.addEventListener('keydown', onInput)
    arm()
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      window.removeEventListener('pointerdown', onInput)
      window.removeEventListener('keydown', onInput)
      wake.current = () => {}
      setRest('awake')
    }
  }, [sleepy])

  useEffect(() => wake.current(), [mood, beat, peek])

  // Blinks and ear twitches, at random.
  useEffect(() => {
    let id = 0
    let ear = 0
    const blinkSoon = () => {
      id = window.setTimeout(
        () => {
          setBlink(true)
          window.setTimeout(() => setBlink(false), 140)
          // Now and then a double blink.
          if (Math.random() < 0.2)
            window.setTimeout(() => {
              setBlink(true)
              window.setTimeout(() => setBlink(false), 120)
            }, 300)
          blinkSoon()
        },
        2200 + Math.random() * 3800,
      )
    }
    const twitchSoon = () => {
      ear = window.setTimeout(
        () => {
          setTwitch(Math.random() < 0.5 ? 'L' : 'R')
          window.setTimeout(() => setTwitch(null), 420)
          twitchSoon()
        },
        4000 + Math.random() * 7000,
      )
    }
    blinkSoon()
    twitchSoon()
    return () => {
      window.clearTimeout(id)
      window.clearTimeout(ear)
    }
  }, [])

  // Eyes (and a little head tilt) follow the pointer or the last tap; otherwise it
  // reads the music below, with the odd glance around. Straight to CSS, no renders.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const seen = { at: -Infinity }
    const look = (x: number, y: number) => {
      el.style.setProperty('--lx', x.toFixed(2))
      el.style.setProperty('--ly', y.toFixed(2))
      el.style.setProperty('--tilt', `${(x * 1.5).toFixed(2)}deg`)
    }
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height * 0.6)
      const d = Math.hypot(dx, dy) || 1
      // Ease toward full reach over a few hundred px, so nearby taps get a glance.
      const reach = Math.min(1, d / 260)
      look((dx / d) * reach, (dy / d) * reach * 0.8)
      seen.at = performance.now()
    }
    const home = variant === 'peek' ? 0.6 : 0.15
    const id = window.setInterval(() => {
      if (performance.now() - seen.at < LOOK_HOLD_MS) return
      if (Math.random() < 0.22)
        look((Math.random() * 2 - 1) * 0.8, Math.random() * 0.5 - 0.25)
      else look(0, home)
    }, 1700)
    look(0, home)
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerdown', onPointer, { passive: true })
    return () => {
      window.clearInterval(id)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [variant])

  // Ears prick up at sounds while listening for the piano.
  useEffect(() => {
    if (!hearMic) return
    const el = root.current
    const off = onMicLevel((level) => el?.style.setProperty('--level', level.toFixed(2)))
    return () => {
      off()
      el?.style.setProperty('--level', '0')
    }
  }, [hearMic])

  useEffect(() => {
    if (!petting) return
    const id = window.setTimeout(() => {
      setPetting(0)
      setLoved(false)
    }, PET_MS)
    return () => window.clearTimeout(id)
  }, [petting])

  // A pet or two: contented purring. Keep going and it's heart eyes.
  const pet = () => {
    const now = Date.now()
    const p = pets.current
    p.count = now - p.last <= PET_GAP_MS ? p.count + 1 : 1
    p.last = now
    if (p.count >= PETS_FOR_LOVE) setLoved(true)
    setPetting((n) => n + 1)
    onPet?.()
  }

  const peekVariant = variant === 'peek'
  const classes = [
    styles.cat,
    styles[variant],
    styles[face],
    hearMic && styles.hearMic,
    twitch && styles[`twitch${twitch}`],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const inner = (
    <>
      <svg
        viewBox={peekVariant ? '3 7 58 51' : '3 7 58 48'}
        className={styles.svg}
        aria-hidden="true"
      >
        {peekVariant && (
          <defs>
            <clipPath id={clip}>
              <rect x="-20" y="-20" width="104" height="71" />
            </clipPath>
          </defs>
        )}
        <g clipPath={peekVariant ? `url(#${clip})` : undefined}>
          <g key={peek} className={styles.rise}>
            <g className={styles.tilt}>
              <g key={`${face}-${beat ?? ''}-${petting}`} className={styles.bob}>
                <Head face={face} blink={blink && OPEN_EYES.includes(face)} />
              </g>
            </g>
          </g>
        </g>
        {peekVariant && (
          <g key={`paws-${face}-${beat ?? ''}-${petting}`} className={styles.paws}>
            <g className={styles.pawL}>
              <ellipse cx="21" cy="52.2" rx="6.2" ry="4.5" className={styles.paw} />
              <path d="M19.2 56.4v-1.9M22.8 56.4v-1.9" className={styles.toes} />
            </g>
            <g className={styles.pawR}>
              <ellipse cx="43" cy="52.2" rx="6.2" ry="4.5" className={styles.paw} />
              <path d="M41.2 56.4v-1.9M44.8 56.4v-1.9" className={styles.toes} />
            </g>
          </g>
        )}
      </svg>
      <Floaters key={`${face}-${beat ?? ''}-${petting}`} face={face} streak={streak} />
    </>
  )

  return onPet !== undefined || petLabel ? (
    <button
      ref={root as React.RefObject<HTMLButtonElement>}
      type="button"
      className={classes}
      style={style}
      onClick={pet}
      aria-label={petLabel}
    >
      {inner}
    </button>
  ) : (
    <span
      ref={root as React.RefObject<HTMLSpanElement>}
      className={classes}
      style={style}
      aria-hidden="true"
    >
      {inner}
    </span>
  )
}

function Head({ face, blink }: { face: Face; blink: boolean }) {
  const cheeks = face === 'happy' || face === 'love' || face === 'purr' ? 0.7 : 0.28
  return (
    <>
      <g className={styles.earL}>
        <path
          // Reaches well down into the head (hidden there), so however the ear
          // turns it stays joined on.
          d="M16.2 24 15.8 11.5c.2-1.5 1.9-2.2 3.1-1.3L28.6 18 28 29 18 30Z"
          className={styles.fur}
        />
        <path d="M19 14.5 25.5 19.6" className={styles.innerEar} />
      </g>
      <g className={styles.earR}>
        <path
          d="M47.8 24 48.2 11.5c-.2-1.5-1.9-2.2-3.1-1.3L35.4 18 36 29 46 30Z"
          className={styles.fur}
        />
        <path d="M45 14.5 38.5 19.6" className={styles.innerEar} />
      </g>
      <path
        d="M14.5 25C18 20.2 23.6 17.6 28 17.4c2.6-.6 5.4-.6 8 0 4.4.2 10 2.8 13.5 7.6 2.3 3.4 3.5 7.3 3.5 11.3C53 47.5 43.6 54 32 54s-21-6.5-21-17.7c0-4 1.2-7.9 3.5-11.3Z"
        className={styles.fur}
      />

      <ellipse
        cx="17.6"
        cy="41.4"
        rx="3.2"
        ry="1.9"
        className={styles.cheek}
        opacity={cheeks}
      />
      <ellipse
        cx="46.4"
        cy="41.4"
        rx="3.2"
        ry="1.9"
        className={styles.cheek}
        opacity={cheeks}
      />

      <g className={styles.eyes}>
        <Eyes face={face} blink={blink} />
      </g>

      <path
        d="M29.6 41.2h4.8c.7 0 1 .8.6 1.3l-2.4 2.3c-.3.3-.8.3-1.1 0l-2.4-2.3c-.5-.5-.2-1.3.5-1.3Z"
        className={styles.nose}
      />
      <Mouth face={face} />

      <g className={styles.whiskers}>
        <path d="M15.5 42.6 6 41.2M15.6 44.8 6.6 46.2" />
        <path d="M48.5 42.6 58 41.2M48.4 44.8 57.4 46.2" />
      </g>
    </>
  )
}

function Eyes({ face, blink }: { face: Face; blink: boolean }) {
  switch (face) {
    case 'happy':
    case 'purr':
      return (
        <path
          d="M20.4 36.6Q24 31.2 27.6 36.6M36.4 36.6Q40 31.2 43.6 36.6"
          className={styles.line}
        />
      )
    case 'love':
      return (
        <>
          <Heart x={24} y={35} />
          <Heart x={40} y={35} />
        </>
      )
    case 'listening':
    case 'asleep':
      return (
        <path
          d={
            face === 'asleep'
              ? 'M20.6 36.2Q24 38 27.4 36.2M36.6 36.2Q40 38 43.4 36.2'
              : 'M20.6 35.2Q24 38.6 27.4 35.2M36.6 35.2Q40 38.6 43.4 35.2'
          }
          className={styles.line}
        />
      )
    case 'yawn':
      return (
        <path
          d="M20.6 34.6 27 36.4 20.8 38M43.4 34.6 37 36.4 43.2 38"
          className={styles.line}
        />
      )
    case 'startled':
    case 'curious':
      return (
        <>
          <circle
            cx="24"
            cy="35"
            r={face === 'startled' ? 4.6 : 4.2}
            className={styles.eye}
          />
          <circle
            cx="40"
            cy="35"
            r={face === 'startled' ? 4.6 : 4.2}
            className={styles.eye}
          />
          <g className={styles.pupils}>
            <circle cx="24" cy="35.3" r="2.7" className={styles.pupil} />
            <circle cx="40" cy="35.3" r="2.7" className={styles.pupil} />
          </g>
          <circle cx="25.5" cy="33.3" r="1.5" className={styles.shine} />
          <circle cx="41.5" cy="33.3" r="1.5" className={styles.shine} />
        </>
      )
    default: {
      const sad = face === 'sad'
      return (
        <>
          <g className={blink ? styles.blink : styles.open}>
            <ellipse
              cx="24"
              cy="35.4"
              rx="3.3"
              ry={sad ? 3.4 : 3.9}
              className={styles.eye}
            />
            <g className={styles.pupils}>
              <ellipse
                cx="24"
                cy="35.6"
                rx="2.1"
                ry={sad ? 2.2 : 2.6}
                className={styles.pupil}
              />
            </g>
            <circle cx="25.2" cy="33.8" r="1.15" className={styles.shine} />
            <circle cx="22.9" cy="36.9" r="0.5" className={styles.shine} />
          </g>
          <g className={blink ? styles.blink : styles.open}>
            <ellipse
              cx="40"
              cy="35.4"
              rx="3.3"
              ry={sad ? 3.4 : 3.9}
              className={styles.eye}
            />
            <g className={styles.pupils}>
              <ellipse
                cx="40"
                cy="35.6"
                rx="2.1"
                ry={sad ? 2.2 : 2.6}
                className={styles.pupil}
              />
            </g>
            <circle cx="41.2" cy="33.8" r="1.15" className={styles.shine} />
            <circle cx="38.9" cy="36.9" r="0.5" className={styles.shine} />
          </g>
          {sad && (
            <path d="M20.2 30.6 26.8 28.8M43.8 30.6 37.2 28.8" className={styles.brow} />
          )}
          {face === 'confused' && (
            <path d="M37.2 29.6Q40.4 27.6 43.6 29.4" className={styles.brow} />
          )}
        </>
      )
    }
  }
}

function Mouth({ face }: { face: Face }) {
  switch (face) {
    case 'happy':
    case 'love':
      return (
        <path
          d="M28.4 45.3h7.2c-.2 3.2-1.6 4.7-3.6 4.7s-3.4-1.5-3.6-4.7Z"
          className={styles.mouthOpen}
        />
      )
    case 'sad':
      return <path d="M29 48.2Q32 45.6 35 48.2" className={styles.mouth} />
    case 'confused':
      return <path d="M29.6 47.4Q31 46.4 32.4 47.2T35 46.8" className={styles.mouth} />
    case 'startled':
    case 'curious':
      return <ellipse cx="32" cy="47.4" rx="1.6" ry="2" className={styles.mouth} />
    case 'yawn':
      return <ellipse cx="32" cy="47.6" rx="2.9" ry="3.1" className={styles.mouthOpen} />
    default:
      return (
        <path
          d="M32 45.2c-.8 1.6-2.3 2.4-4 2.1M32 45.2c.8 1.6 2.3 2.4 4 2.1"
          className={styles.mouth}
        />
      )
  }
}

function Heart({ x, y }: { x: number; y: number }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M0 3.6C-2.6 1.8-4 .4-4-1.4-4-2.8-3-3.8-1.8-3.8-.9-3.8-.3-3.3 0-2.6.3-3.3.9-3.8 1.8-3.8 3-3.8 4-2.8 4-1.4 4 .4 2.6 1.8 0 3.6Z"
      className={styles.heartEye}
    />
  )
}

const HeartIcon = () => (
  <svg viewBox="-4.4 -4.2 8.8 8.2" width="100%" height="100%">
    <path
      d="M0 3.6C-2.6 1.8-4 .4-4-1.4-4-2.8-3-3.8-1.8-3.8-.9-3.8-.3-3.3 0-2.6.3-3.3.9-3.8 1.8-3.8 3-3.8 4-2.8 4-1.4 4 .4 2.6 1.8 0 3.6Z"
      fill="currentColor"
    />
  </svg>
)

const Drop = () => (
  <svg viewBox="0 0 10 14" width="100%" height="100%">
    <path
      d="M5 1C6.8 4.4 9 6.6 9 9a4 4 0 0 1-8 0c0-2.4 2.2-4.6 4-8Z"
      fill="currentColor"
    />
  </svg>
)

/** Little things that float up around the cat's head. */
function Floaters({ face, streak }: { face: Face; streak: number }) {
  const items: { glyph: React.ReactNode; kind: string; slot: number }[] = []
  if (face === 'listening')
    items.push(
      { glyph: '♪', kind: styles.note, slot: 0 },
      { glyph: '♫', kind: styles.note, slot: 1 },
      { glyph: '♪', kind: styles.note, slot: 2 },
    )
  if (face === 'love')
    items.push(
      { glyph: <HeartIcon />, kind: styles.heart, slot: 0 },
      { glyph: <HeartIcon />, kind: styles.heart, slot: 1 },
      { glyph: <HeartIcon />, kind: styles.heart, slot: 2 },
    )
  if (face === 'happy' && streak >= 3)
    items.push(
      { glyph: '✦', kind: styles.sparkle, slot: 0 },
      { glyph: '✦', kind: styles.sparkle, slot: 1 },
      { glyph: '✧', kind: styles.sparkle, slot: 2 },
    )
  if (face === 'purr') items.push({ glyph: 'prr', kind: styles.prr, slot: 1 })
  if (face === 'sad') items.push({ glyph: <Drop />, kind: styles.drop, slot: 1 })
  if (face === 'confused') items.push({ glyph: '?', kind: styles.question, slot: 1 })
  if (face === 'curious') items.push({ glyph: '!', kind: styles.question, slot: 1 })
  if (face === 'asleep')
    items.push(
      { glyph: 'z', kind: styles.zzz, slot: 0 },
      { glyph: 'z', kind: styles.zzz, slot: 1 },
      { glyph: 'Z', kind: styles.zzz, slot: 2 },
    )
  if (!items.length) return null
  return (
    <span className={styles.floaters} aria-hidden="true">
      {items.map((it, i) => (
        <span
          key={i}
          className={`${styles.floater} ${it.kind} ${styles[`slot${it.slot}`]}`}
        >
          {it.glyph}
        </span>
      ))}
    </span>
  )
}
