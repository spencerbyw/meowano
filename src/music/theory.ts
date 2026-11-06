/**
 * A small, self-contained music theory toolkit.
 *
 * Pitches are tracked by *diatonic step* (letter + octave) separately from their
 * accidental, so spelling is always explicit: a note is "F♯" because the key says
 * so, never because we picked one of two enharmonic names.
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Letter = (typeof LETTERS)[number]

export type Accidental = '' | '#' | 'b' | '##' | 'bb'

export interface Pitch {
  letter: Letter
  acc: Accidental
  octave: number
}

const NATURAL_SEMITONES: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}
const ACC_OFFSET: Record<Accidental, number> = { '': 0, '#': 1, b: -1, '##': 2, bb: -2 }
const OFFSET_ACC: Record<number, Accidental> = {
  0: '',
  1: '#',
  [-1]: 'b',
  2: '##',
  [-2]: 'bb',
}

export const mod = (n: number, m: number) => ((n % m) + m) % m

/** Diatonic step index: C4 = 28, D4 = 29 … */
export const stepOf = (p: Pitch) => p.octave * 7 + LETTERS.indexOf(p.letter)

export const letterAt = (step: number): Letter => LETTERS[mod(step, 7)]
export const octaveAt = (step: number) => Math.floor(step / 7)

export const midiOf = (p: Pitch) =>
  (p.octave + 1) * 12 + NATURAL_SEMITONES[p.letter] + ACC_OFFSET[p.acc]

export const pitchClass = (p: Pitch) => `${p.letter}${p.acc}`
export const pitchName = (p: Pitch) => `${p.letter}${p.acc}${p.octave}`

export function parsePitch(name: string): Pitch {
  const m = /^([A-G])(##|bb|#|b)?(-?\d+)$/.exec(name)
  if (!m) throw new Error(`Bad pitch: ${name}`)
  return { letter: m[1] as Letter, acc: (m[2] ?? '') as Accidental, octave: Number(m[3]) }
}

/** Spell the pitch at `step` so that it sounds at `midi`, or null if that needs > 2 accidentals. */
export function spellAt(step: number, midi: number): Pitch | null {
  const letter = letterAt(step)
  const octave = octaveAt(step)
  const natural = (octave + 1) * 12 + NATURAL_SEMITONES[letter]
  const acc = OFFSET_ACC[midi - natural]
  return acc === undefined ? null : { letter, acc, octave }
}

export function alter(p: Pitch, semitones: number): Pitch | null {
  return spellAt(stepOf(p), midiOf(p) + semitones)
}

// ---------------------------------------------------------------------------
// Keys

/** Major keys indexed by number of fifths (-7 = 7 flats … +7 = 7 sharps). */
export const MAJOR_KEYS: Record<number, string> = {
  [-7]: 'Cb',
  [-6]: 'Gb',
  [-5]: 'Db',
  [-4]: 'Ab',
  [-3]: 'Eb',
  [-2]: 'Bb',
  [-1]: 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
}

const SHARP_ORDER: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

export interface Key {
  fifths: number
  /** VexFlow-compatible key name, e.g. "Bb". */
  name: string
  tonic: Letter
  accidentals: Record<Letter, Accidental>
}

export function majorKey(fifths: number): Key {
  const accidentals = Object.fromEntries(LETTERS.map((l) => [l, ''])) as Record<
    Letter,
    Accidental
  >
  if (fifths > 0) SHARP_ORDER.slice(0, fifths).forEach((l) => (accidentals[l] = '#'))
  if (fifths < 0) FLAT_ORDER.slice(0, -fifths).forEach((l) => (accidentals[l] = 'b'))
  const name = MAJOR_KEYS[fifths]
  return { fifths, name, tonic: name[0] as Letter, accidentals }
}

/** The pitch at a diatonic step, spelled as the key signature says. */
export function inKey(step: number, key: Key): Pitch {
  const letter = letterAt(step)
  return { letter, acc: key.accidentals[letter], octave: octaveAt(step) }
}

/** Which accidental (if any) must be printed for this pitch under this key signature. */
export function displayedAccidental(p: Pitch, key: Key): Accidental | 'n' | null {
  const expected = key.accidentals[p.letter]
  if (p.acc === expected) return null
  return p.acc === '' ? 'n' : p.acc
}

/** Scale degree (0 = tonic) of a letter in a key. */
export const degreeOf = (letter: Letter, key: Key) =>
  mod(LETTERS.indexOf(letter) - LETTERS.indexOf(key.tonic), 7)

// ---------------------------------------------------------------------------
// Intervals

/** Interval name like "M3", "P5", "A4" between two ascending pitches (up to an octave). */
export function intervalName(low: Pitch, high: Pitch): string | null {
  const number = stepOf(high) - stepOf(low) + 1
  const semis = midiOf(high) - midiOf(low)
  if (number < 1 || number > 8) return null
  const perfectBase: Record<number, number> = { 1: 0, 4: 5, 5: 7, 8: 12 }
  const majorBase: Record<number, number> = { 2: 2, 3: 4, 6: 9, 7: 11 }
  if (number in perfectBase) {
    const q = { [-1]: 'd', 0: 'P', 1: 'A' }[semis - perfectBase[number]]
    return q ? `${q}${number}` : null
  }
  const q = { [-2]: 'd', [-1]: 'm', 0: 'M', 1: 'A' }[semis - majorBase[number]]
  return q ? `${q}${number}` : null
}

// ---------------------------------------------------------------------------
// Triads

export type TriadQuality =
  'major' | 'minor' | 'diminished' | 'augmented' | 'sus2' | 'sus4'

/** Steps above the root and semitones above the root for each chord tone. */
const TRIAD_SHAPES: Record<TriadQuality, { steps: number[]; semis: number[] }> = {
  major: { steps: [0, 2, 4], semis: [0, 4, 7] },
  minor: { steps: [0, 2, 4], semis: [0, 3, 7] },
  diminished: { steps: [0, 2, 4], semis: [0, 3, 6] },
  augmented: { steps: [0, 2, 4], semis: [0, 4, 8] },
  sus2: { steps: [0, 1, 4], semis: [0, 2, 7] },
  sus4: { steps: [0, 3, 4], semis: [0, 5, 7] },
}

/** Build a root-position triad on a spelled root, or null if spelling would be absurd. */
export function buildTriad(root: Pitch, quality: TriadQuality): Pitch[] | null {
  const shape = TRIAD_SHAPES[quality]
  const rootStep = stepOf(root)
  const rootMidi = midiOf(root)
  const notes: Pitch[] = []
  for (let i = 0; i < 3; i++) {
    const p = spellAt(rootStep + shape.steps[i], rootMidi + shape.semis[i])
    if (!p || p.acc.length > 1) return null // avoid double sharps/flats
    notes.push(p)
  }
  return notes
}

/** The quality of the diatonic triad on a scale degree (0-based) of a major key. */
export const DIATONIC_QUALITIES: TriadQuality[] = [
  'major',
  'minor',
  'minor',
  'major',
  'major',
  'minor',
  'diminished',
]

/** Rearrange a root-position triad into an inversion (0, 1 or 2), ascending. */
export function invert(notes: Pitch[], inversion: number): Pitch[] {
  const out = notes.map((n) => ({ ...n }))
  for (let i = 0; i < inversion; i++) {
    const lowest = out.shift()!
    out.push({ ...lowest, octave: lowest.octave + 1 })
  }
  return out
}
