import { IconArrowLeft, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import type { TFunction } from 'i18next'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PIANO_RANGE, holdNote, unlockAudio, useAudioStatus } from '../audio/engine'
import { PeekCat } from '../components/PeekCat'
import { Button3D } from '../components/ui/Button3D'
import { useQuiz } from '../quiz/store'
import { useMediaQuery } from '../ui/useMediaQuery'
import styles from './KeyboardScreen.module.css'

const BLACK = new Set([1, 3, 6, 8, 10])
const isBlack = (midi: number) => BLACK.has(midi % 12)
const MIDDLE_C = 60

/** The white keys, low to high, across the range there are samples for. */
const WHITES = Array.from(
  { length: PIANO_RANGE.high - PIANO_RANGE.low + 1 },
  (_, i) => PIANO_RANGE.low + i,
).filter((m) => !isBlack(m))
/** The black keys, each with the white key it sits just after. */
const BLACKS = WHITES.flatMap((m, i) =>
  isBlack(m + 1) && m + 1 <= PIANO_RANGE.high ? [{ midi: m + 1, after: i }] : [],
)
const OCTAVE = 7
/** About how wide a white key should be (px): comfortable for a fingertip. */
const KEY_W = 56
const FEWEST_KEYS = 7

/** Phones held upright: the keyboard turns sideways (it needs the long side). */
const SIDEWAYS = '(orientation: portrait) and (max-width: 599px)'

export function KeyboardScreen() {
  const { t } = useTranslation()
  const goHome = useQuiz((s) => s.goHome)
  const piano = useAudioStatus((s) => s.piano)
  const sideways = useMediaQuery(SIDEWAYS)
  const keysRef = useRef<HTMLDivElement>(null)
  const [stageW, setStageW] = useState(0)
  const visible = Math.min(
    WHITES.length,
    Math.max(FEWEST_KEYS, Math.round(stageW / KEY_W) || FEWEST_KEYS),
  )
  const keyW = stageW / visible || KEY_W
  const lastFirst = WHITES.length - visible
  // Starts on middle C (or as near as fits).
  const [wantFirst, setFirst] = useState(WHITES.indexOf(MIDDLE_C))
  const first = Math.max(0, Math.min(lastFirst, wantFirst))
  const pressed = usePlaying(keysRef)

  // Start loading the piano now (opening this screen was a tap).
  useEffect(() => unlockAudio(), [])

  useLayoutEffect(() => {
    const el = keysRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setStageW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const shift = (by: number) => setFirst(Math.max(0, Math.min(lastFirst, first + by)))

  return (
    <div className={`screen-frame ${styles.screen} ${sideways ? styles.sideways : ''}`}>
      <h1 className="visually-hidden">{t('keyboard.title')}</h1>
      <header className={styles.top}>
        <Button3D variant="ghost" size="sm" onClick={goHome} aria-label={t('toybox.back')}>
          <IconArrowLeft size={22} aria-hidden="true" />
        </Button3D>
        <div className={styles.nav}>
          <Button3D
            variant="secondary"
            size="sm"
            className={styles.octave}
            aria-label={t('keyboard.lower')}
            disabled={first === 0}
            onClick={() => shift(-OCTAVE)}
          >
            <IconChevronLeft size={24} stroke={2.75} aria-hidden="true" />
          </Button3D>
          <Minimap first={first} visible={visible} sideways={sideways} onMove={setFirst} />
          <Button3D
            variant="secondary"
            size="sm"
            className={styles.octave}
            aria-label={t('keyboard.higher')}
            disabled={first === lastFirst}
            onClick={() => shift(OCTAVE)}
          >
            <IconChevronRight size={24} stroke={2.75} aria-hidden="true" />
          </Button3D>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.piano}>
          <PeekCat
            className={styles.cat}
            mood={pressed.size ? 'listening' : 'idle'}
            sleepy={!pressed.size}
          />
          <div className={styles.lid}>
            {piano === 'loading' && <span className={styles.status}>{t('keyboard.loading')}</span>}
            {piano === 'error' && <span className={styles.status}>{t('keyboard.error')}</span>}
          </div>
          <div
            ref={keysRef}
            className={styles.keys}
            style={{ '--key-w': `${keyW}px` } as React.CSSProperties}
            role="group"
            aria-label={t('keyboard.keys')}
          >
            <div
              className={styles.strip}
              style={{ transform: `translateX(${-first * keyW}px)` }}
            >
              {WHITES.map((midi, i) => (
                <div
                  key={midi}
                  data-midi={midi}
                  className={[
                    styles.white,
                    pressed.has(midi) && styles.down,
                    midi === MIDDLE_C && styles.middleC,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ left: i * keyW }}
                >
                  {midi % 12 === 0 && (
                    <span className={styles.label}>
                      {t('notes.C')}
                      {midi / 12 - 1}
                    </span>
                  )}
                </div>
              ))}
              {BLACKS.map(({ midi, after }) => (
                <div
                  key={midi}
                  data-midi={midi}
                  className={`${styles.black} ${pressed.has(midi) ? styles.down : ''}`}
                  style={{ left: (after + 1) * keyW }}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * Fingers on keys: each pointer holds its own note, and sliding along the keys
 * moves it from key to key (a glissando). Returns the keys held down now.
 */
function usePlaying(keysRef: React.RefObject<HTMLDivElement | null>) {
  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set())

  useEffect(() => {
    const el = keysRef.current
    if (!el) return
    const fingers = new Map<number, { midi: number; lift: () => void }>()
    const update = () => setPressed(new Set([...fingers.values()].map((f) => f.midi)))
    const keyAt = (x: number, y: number) => {
      const key = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-midi]')
      return key && el.contains(key) ? Number(key.dataset.midi) : null
    }
    const press = (id: number, midi: number | null) => {
      const was = fingers.get(id)
      if (was?.midi === midi) return
      was?.lift()
      if (midi === null) fingers.delete(id)
      else fingers.set(id, { midi, lift: holdNote(midi) })
      update()
    }
    const lift = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return
      press(e.pointerId, null)
    }
    const liftAll = () => {
      fingers.forEach((f) => f.lift())
      fingers.clear()
      update()
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      // Keep hearing this pointer even if it slides off the keys.
      el.setPointerCapture(e.pointerId)
      press(e.pointerId, keyAt(e.clientX, e.clientY))
    }
    const move = (e: PointerEvent) => {
      if (!el.hasPointerCapture(e.pointerId)) return
      press(e.pointerId, keyAt(e.clientX, e.clientY))
    }
    const onHide = () => document.hidden && liftAll()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', lift)
    el.addEventListener('pointercancel', lift)
    el.addEventListener('lostpointercapture', lift)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', lift)
      el.removeEventListener('pointercancel', lift)
      el.removeEventListener('lostpointercapture', lift)
      document.removeEventListener('visibilitychange', onHide)
      liftAll()
    }
  }, [keysRef])

  return pressed
}

/**
 * The whole keyboard in miniature, with a window over the keys on screen: tap or
 * drag it to move along.
 */
function Minimap({
  first,
  visible,
  sideways,
  onMove,
}: {
  first: number
  visible: number
  sideways: boolean
  onMove: (first: number) => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const W = 10
  const H = 34

  // Centre the window where the pointer is. Turned sideways, "along the keyboard"
  // runs up the screen.
  const moveTo = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const along = sideways ? (r.bottom - e.clientY) / r.height : (e.clientX - r.left) / r.width
    onMove(Math.round(along * WHITES.length - visible / 2))
  }

  return (
    <div
      ref={ref}
      className={styles.minimap}
      role="slider"
      tabIndex={0}
      aria-label={t('keyboard.where')}
      aria-valuemin={0}
      aria-valuemax={WHITES.length - visible}
      aria-valuenow={first}
      aria-valuetext={t('keyboard.whereValue', {
        from: noteName(t, WHITES[first]),
        to: noteName(t, WHITES[first + visible - 1]),
      })}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        moveTo(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e)
      }}
      onKeyDown={(e) => {
        const by = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]
        if (!by) return
        e.preventDefault()
        onMove(first + by)
      }}
    >
      <svg
        viewBox={`0 0 ${WHITES.length * W} ${H}`}
        preserveAspectRatio="none"
        className={styles.miniSvg}
        aria-hidden="true"
      >
        {WHITES.map((midi, i) => (
          <rect
            key={midi}
            x={i * W + 0.5}
            y={0.5}
            width={W - 1}
            height={H - 1}
            rx={1.5}
            className={midi === MIDDLE_C ? styles.miniMiddleC : styles.miniWhite}
          />
        ))}
        {BLACKS.map(({ midi, after }) => (
          <rect
            key={midi}
            x={(after + 1) * W - 3}
            y={0}
            width={6}
            height={H * 0.6}
            rx={1}
            className={styles.miniBlack}
          />
        ))}
      </svg>
      <span
        className={styles.window}
        style={{
          left: `${(first / WHITES.length) * 100}%`,
          width: `${(visible / WHITES.length) * 100}%`,
        }}
      />
    </div>
  )
}

const LETTERS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'] as const
/** "C4"; black keys by the white key below ("C♯4"). */
const noteName = (t: TFunction, midi: number) =>
  `${t(`notes.${LETTERS[midi % 12]}`)}${isBlack(midi) ? t('accidentals.#') : ''}${Math.floor(midi / 12) - 1}`
