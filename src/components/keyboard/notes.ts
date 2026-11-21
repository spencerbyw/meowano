import type { TFunction } from 'i18next'
import { PIANO_RANGE } from '../../audio/engine'

const BLACK = new Set([1, 3, 6, 8, 10])
export const isBlack = (midi: number) => BLACK.has(midi % 12)
export const MIDDLE_C = 60
export const OCTAVE = 7

/** The white keys, low to high, across the range there are samples for. */
export const WHITES = Array.from(
  { length: PIANO_RANGE.high - PIANO_RANGE.low + 1 },
  (_, i) => PIANO_RANGE.low + i,
).filter((m) => !isBlack(m))
/** The black keys, each with the white key it sits just after. */
export const BLACKS = WHITES.flatMap((m, i) =>
  isBlack(m + 1) && m + 1 <= PIANO_RANGE.high ? [{ midi: m + 1, after: i }] : [],
)

/** Index of the white key a note is on (or, for a black key, just after). */
export const whiteIndex = (midi: number) => {
  const i = WHITES.findIndex((m) => m >= midi)
  return i < 0 ? WHITES.length - 1 : WHITES[i] === midi ? i : i - 1
}

const LETTERS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'] as const
/** "C4"; black keys by the white key below ("C♯4"). */
export const noteName = (t: TFunction, midi: number) =>
  `${t(`notes.${LETTERS[midi % 12]}`)}${isBlack(midi) ? t('accidentals.#') : ''}${Math.floor(midi / 12) - 1}`
