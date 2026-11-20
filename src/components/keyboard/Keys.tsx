import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button3D } from '../ui/Button3D'
import type { KeyView } from './hooks'
import { BLACKS, MIDDLE_C, OCTAVE, WHITES, noteName } from './notes'
import styles from './Keys.module.css'

/*
 * A playable keyboard, in pieces: useKeyView (which keys are on screen),
 * usePlaying (fingers on keys), <Keys> (the keys) and <KeyNav> (octave buttons and
 * a map of the whole keyboard). The toybox keyboard and "Play the note" share them.
 */

export type KeyMark = 'right' | 'wrong'

/**
 * The keys themselves, a strip slid along to `view.first`. C keys are labelled
 * with their octave ("C4"); `marks` colours keys green or red, and `named` labels
 * one key (with its name as the question spells it).
 */
export function Keys({
  view,
  pressed,
  marks,
  named,
  label,
  className,
}: {
  view: KeyView
  pressed: ReadonlySet<number>
  marks?: ReadonlyMap<number, KeyMark>
  named?: { midi: number; text: string }
  label: string
  className?: string
}) {
  const { t } = useTranslation()
  const { keyW, first, attach } = view
  const keyClass = (base: string, midi: number) =>
    [
      base,
      pressed.has(midi) && styles.down,
      marks?.get(midi) && styles[marks.get(midi)!],
      midi === MIDDLE_C && styles.middleC,
    ]
      .filter(Boolean)
      .join(' ')

  return (
    <div
      ref={attach}
      className={[styles.keys, className].filter(Boolean).join(' ')}
      style={{ '--key-w': `${keyW}px` } as React.CSSProperties}
      role="group"
      aria-label={label}
    >
      <div
        className={styles.strip}
        style={{ transform: `translateX(${-first * keyW}px)` }}
      >
        {WHITES.map((midi, i) => (
          <div
            key={midi}
            data-midi={midi}
            className={keyClass(styles.white, midi)}
            style={{ left: i * keyW }}
          >
            {midi === named?.midi ? (
              <span className={styles.name}>{named.text}</span>
            ) : (
              midi % 12 === 0 && (
                <span className={styles.label}>
                  {t('notes.C')}
                  {midi / 12 - 1}
                </span>
              )
            )}
          </div>
        ))}
        {BLACKS.map(({ midi, after }) => (
          <div
            key={midi}
            data-midi={midi}
            className={keyClass(styles.black, midi)}
            style={{ left: (after + 1) * keyW }}
          >
            {midi === named?.midi && <span className={styles.name}>{named.text}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Octave down, a map of the whole keyboard, octave up. */
export function KeyNav({
  view,
  sideways = false,
  className,
}: {
  view: KeyView
  sideways?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { first, lastFirst, moveTo } = view
  return (
    <div className={[styles.nav, className].filter(Boolean).join(' ')}>
      <Button3D
        variant="secondary"
        size="sm"
        className={styles.octave}
        aria-label={t('keyboard.lower')}
        disabled={first === 0}
        onClick={() => moveTo(first - OCTAVE)}
      >
        <IconChevronLeft size={24} stroke={2.75} aria-hidden="true" />
      </Button3D>
      <Minimap view={view} sideways={sideways} />
      <Button3D
        variant="secondary"
        size="sm"
        className={styles.octave}
        aria-label={t('keyboard.higher')}
        disabled={first === lastFirst}
        onClick={() => moveTo(first + OCTAVE)}
      >
        <IconChevronRight size={24} stroke={2.75} aria-hidden="true" />
      </Button3D>
    </div>
  )
}

/**
 * The whole keyboard in miniature, with a window over the keys on screen: tap or
 * drag it to move along.
 */
function Minimap({ view, sideways }: { view: KeyView; sideways: boolean }) {
  const { t } = useTranslation()
  const { first, visible, moveTo } = view
  const ref = useRef<HTMLDivElement>(null)
  const W = 10
  const H = 34

  // Centre the window where the pointer is. Turned sideways, "along the keyboard"
  // runs down the screen.
  const moveToPointer = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const along = sideways
      ? (e.clientY - r.top) / r.height
      : (e.clientX - r.left) / r.width
    moveTo(Math.round(along * WHITES.length - visible / 2))
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
        moveToPointer(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) moveToPointer(e)
      }}
      onKeyDown={(e) => {
        const by = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key]
        if (!by) return
        e.preventDefault()
        moveTo(first + by)
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
