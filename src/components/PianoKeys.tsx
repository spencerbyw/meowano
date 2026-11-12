import type { TFunction } from 'i18next'
import { formatPitchClass } from '../music/format'
import { midiOf, stepOf, type Pitch } from '../music/theory'
import styles from './PianoKeys.module.css'

const WHITE_W = 20
const WHITE_H = 76
const BLACK_W = 12
const BLACK_H = 46
const LABEL_H = 16
/** How many white keys to show (two octaves and a bit). */
const SPAN = 17
const NATURAL = [0, 2, 4, 5, 7, 9, 11]
/** C, D, F, G and A have a black key just above them. */
const HAS_BLACK_ABOVE = [true, true, false, true, true, true, false]
const MIDDLE_C = 60

/** A key: square along the top (where it meets the keyboard), rounded at the bottom. */
const keyPath = (x: number, top: number, w: number, bottom: number, r: number) =>
  `M${x} ${top}H${x + w}V${bottom - r}Q${x + w} ${bottom} ${x + w - r} ${bottom}` +
  `H${x + r}Q${x} ${bottom} ${x} ${bottom - r}Z`

/** A small keyboard centred on the question's notes, with those keys lit up. */
export function PianoKeys({ notes, t }: { notes: Pitch[]; t: TFunction }) {
  const lit = new Map(notes.map((p) => [midiOf(p), p]))
  const steps = notes.map(stepOf)
  const mid = (Math.min(...steps) + Math.max(...steps)) / 2
  const first = Math.round(mid - (SPAN - 1) / 2)
  const width = SPAN * WHITE_W

  const whites: React.ReactNode[] = []
  const blacks: React.ReactNode[] = []
  const labels: React.ReactNode[] = []
  for (let i = 0; i < SPAN; i++) {
    const step = first + i
    const li = ((step % 7) + 7) % 7
    const midi = (Math.floor(step / 7) + 1) * 12 + NATURAL[li]
    const x = i * WHITE_W
    const note = lit.get(midi)
    whites.push(
      <path
        key={midi}
        d={keyPath(x + 0.5, 0.5, WHITE_W - 1, WHITE_H, 3)}
        className={note ? styles.whiteLit : styles.white}
      />,
    )
    if (midi === MIDDLE_C)
      labels.push(
        <circle
          key="c4"
          cx={x + WHITE_W / 2}
          cy={WHITE_H - 9}
          r={2.5}
          className={styles.dot}
        />,
      )
    if (note)
      labels.push(
        <text
          key={midi}
          x={x + WHITE_W / 2}
          y={WHITE_H + LABEL_H - 2}
          className={styles.label}
        >
          {formatPitchClass(t, note)}
        </text>,
      )
    if (HAS_BLACK_ABOVE[li] && i < SPAN - 1) {
      const bnote = lit.get(midi + 1)
      const bx = x + WHITE_W - BLACK_W / 2
      blacks.push(
        <path
          key={midi + 1}
          d={keyPath(bx, 0, BLACK_W, BLACK_H, 2)}
          className={bnote ? styles.blackLit : styles.black}
        />,
      )
      if (bnote)
        labels.push(
          <text
            key={midi + 1}
            x={bx + BLACK_W / 2}
            y={WHITE_H + LABEL_H - 2}
            className={styles.label}
          >
            {formatPitchClass(t, bnote)}
          </text>,
        )
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width + 1} ${WHITE_H + LABEL_H + 1}`}
      className={styles.keys}
      aria-hidden="true"
    >
      {whites}
      {blacks}
      {labels}
    </svg>
  )
}
