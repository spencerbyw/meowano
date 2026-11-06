import type { PracticeSettings, QuestionKind } from '../settings/types'
import { positionRange, spanRange, type Clef, type StepRange } from './ranges'
import {
  DIATONIC_QUALITIES,
  LETTERS,
  alter,
  buildTriad,
  degreeOf,
  inKey,
  intervalName,
  invert,
  majorKey,
  pitchClass,
  pitchName,
  stepOf,
  type Accidental,
  type Key,
  type Letter,
  type Pitch,
  type TriadQuality,
} from './theory'

// ---------------------------------------------------------------------------
// Public types

export interface PitchClass {
  letter: Letter
  acc: Accidental
}

export type Answer =
  | { type: 'note'; note: PitchClass }
  | { type: 'dyad'; interval: string; notes: [PitchClass, PitchClass] }
  | { type: 'triad'; root: PitchClass; quality: TriadQuality; notes: PitchClass[] }

export interface Question {
  /** Unique per generated question (for React keys / animations). */
  id: string
  /** Stable identity of what's on the staff, used for stats ("treble:note:F#4"). */
  statKey: string
  kind: QuestionKind
  clef: Clef
  key: Key
  /** Pitches on the staff, low to high. */
  notes: Pitch[]
  choices: Answer[]
  correctIndex: number
}

export interface GenerateOptions {
  /** statKey of the previous question, so we don't repeat it back-to-back. */
  previousStatKey?: string
  /** Extra weight per statKey (e.g. from miss history). Defaults to 1. */
  weight?: (statKey: string) => number
  random?: () => number
}

// ---------------------------------------------------------------------------
// Helpers

const pc = (p: Pitch): PitchClass => ({ letter: p.letter, acc: p.acc })

export const answerId = (a: Answer): string => {
  switch (a.type) {
    case 'note':
      return `note:${a.note.letter}${a.note.acc}`
    case 'dyad':
      return `dyad:${a.interval}:${a.notes.map((n) => n.letter + n.acc).join('-')}`
    case 'triad':
      return `triad:${a.root.letter}${a.root.acc}:${a.quality}`
  }
}

interface Weighted<T> {
  item: T
  weight: number
}

function pickWeighted<T>(items: Weighted<T>[], random: () => number): T | undefined {
  const total = items.reduce((sum, i) => sum + i.weight, 0)
  if (total <= 0) return undefined
  let r = random() * total
  for (const i of items) {
    r -= i.weight
    if (r <= 0) return i.item
  }
  return items[items.length - 1]?.item
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Spellings we never want to quiz a beginner-to-intermediate player on. */
const AWKWARD = new Set(['E#', 'B#', 'Fb', 'Cb'])
const isAwkward = (p: Pitch, key: Key) =>
  p.acc !== key.accidentals[p.letter] && (AWKWARD.has(pitchClass(p)) || p.acc.length > 1)

/** Interval names we're happy to show; leaves out oddities like d3 or A2. */
const COMMON_INTERVALS = new Set([
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'A4',
  'd5',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
  'P8',
])

/** Chromatic alterations that fit the key's "direction" (sharps in sharp keys, etc). */
function chromaticVariants(p: Pitch, key: Key): Pitch[] {
  const expected = key.accidentals[p.letter]
  const out: (Pitch | null)[] = []
  if (expected !== '') out.push({ ...p, acc: '' })
  else {
    if (key.fifths >= 0) out.push(alter(p, 1))
    if (key.fifths <= 0) out.push(alter(p, -1))
  }
  return out.filter((v): v is Pitch => !!v && !isAwkward(v, key))
}

// ---------------------------------------------------------------------------
// Candidates: every question that fits the settings, so we can weight and pick.

interface Candidate {
  statKey: string
  kind: QuestionKind
  notes: Pitch[]
  answer: Answer
  weight: number
  /** For triads: the root-position chord, used to build distractors. */
  triad?: { root: Pitch; quality: TriadQuality; inversion: number }
}

function noteCandidates(range: StepRange, key: Key, s: PracticeSettings, clef: Clef) {
  const out: Candidate[] = []
  for (let step = range.low; step <= range.high; step++) {
    const base = inKey(step, key)
    const variants: Weighted<Pitch>[] = [{ item: base, weight: 1 }]
    if (s.accidentals) {
      chromaticVariants(base, key).forEach((v) => variants.push({ item: v, weight: 0.3 }))
    }
    for (const { item: p, weight } of variants) {
      out.push({
        statKey: `${clef}:note:${pitchName(p)}`,
        kind: 'note',
        notes: [p],
        answer: { type: 'note', note: pc(p) },
        weight,
      })
    }
  }
  return out
}

function dyadCandidates(range: StepRange, key: Key, s: PracticeSettings, clef: Clef) {
  const out: Candidate[] = []
  const push = (low: Pitch, high: Pitch, weight: number) => {
    const interval = intervalName(low, high)
    if (!interval || !COMMON_INTERVALS.has(interval)) return
    out.push({
      statKey: `${clef}:dyad:${pitchName(low)}-${pitchName(high)}`,
      kind: 'dyad',
      notes: [low, high],
      answer: { type: 'dyad', interval, notes: [pc(low), pc(high)] },
      weight,
    })
  }
  for (let step = range.low; step <= range.high; step++) {
    for (const size of s.intervals) {
      const top = step + size - 1
      if (top > range.high) continue
      const low = inKey(step, key)
      const high = inKey(top, key)
      push(low, high, 1)
      if (s.accidentals) chromaticVariants(high, key).forEach((v) => push(low, v, 0.2))
    }
  }
  return out
}

function triadTemplates(s: PracticeSettings) {
  const out: Weighted<{ degree: number; quality: TriadQuality }>[] = []
  const degrees = s.triadSet === 'primary' ? [0, 3, 4] : [0, 1, 2, 3, 4, 5, 6]
  degrees.forEach((degree) =>
    out.push({ item: { degree, quality: DIATONIC_QUALITIES[degree] }, weight: 1 }),
  )
  if (s.accidentals) {
    // Borrowed / secondary chords: switch major <-> minor on a scale degree.
    degrees.forEach((degree) => {
      const q = DIATONIC_QUALITIES[degree]
      if (q === 'major') out.push({ item: { degree, quality: 'minor' }, weight: 0.25 })
      if (q === 'minor') out.push({ item: { degree, quality: 'major' }, weight: 0.25 })
    })
  }
  if (s.extraChords) {
    for (let degree = 0; degree < 7; degree++) {
      for (const quality of ['sus2', 'sus4', 'augmented', 'diminished'] as const) {
        if (quality === DIATONIC_QUALITIES[degree]) continue
        out.push({ item: { degree, quality }, weight: 0.15 })
      }
    }
  }
  return out
}

function triadCandidates(range: StepRange, key: Key, s: PracticeSettings, clef: Clef) {
  const out: Candidate[] = []
  const tonicStep = LETTERS.indexOf(key.tonic)
  const inversions = s.inversions ? [0, 1, 2] : [0]
  for (const { item: t, weight } of triadTemplates(s)) {
    // Try every octave for this root.
    for (let octave = 0; octave <= 7; octave++) {
      const root = inKey(octave * 7 + tonicStep + t.degree, key)
      const chord = buildTriad(root, t.quality)
      if (!chord || chord.some((n) => isAwkward(n, key))) continue
      for (const inversion of inversions) {
        const notes = invert(chord, inversion)
        if (stepOf(notes[0]) < range.low || stepOf(notes[2]) > range.high) continue
        out.push({
          statKey: `${clef}:triad:${notes.map(pitchName).join('-')}`,
          kind: 'triad',
          notes,
          answer: {
            type: 'triad',
            root: pc(root),
            quality: t.quality,
            notes: chord.map(pc),
          },
          weight: inversion === 0 ? weight : weight * 0.7,
          triad: { root, quality: t.quality, inversion },
        })
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Distractors: plausible mistakes, never enharmonic tricks.

function diatonicTriadAnswer(step: number, key: Key): Answer | null {
  const root = inKey(step, key)
  const quality = DIATONIC_QUALITIES[degreeOf(root.letter, key)]
  const chord = buildTriad(root, quality)
  if (!chord) return null
  return { type: 'triad', root: pc(root), quality, notes: chord.map(pc) }
}

function triadAnswer(root: Pitch, quality: TriadQuality, key: Key): Answer | null {
  const chord = buildTriad(root, quality)
  if (!chord || chord.some((n) => isAwkward(n, key))) return null
  return { type: 'triad', root: pc(root), quality, notes: chord.map(pc) }
}

function dyadAnswer(low: Pitch, high: Pitch): Answer | null {
  const interval = intervalName(low, high)
  if (!interval || !COMMON_INTERVALS.has(interval)) return null
  return { type: 'dyad', interval, notes: [pc(low), pc(high)] }
}

const QUALITY_SWAPS: Partial<Record<TriadQuality, TriadQuality>> = {
  major: 'minor',
  minor: 'major',
  diminished: 'minor',
  augmented: 'major',
  sus2: 'sus4',
  sus4: 'sus2',
}

function distractorPool(c: Candidate, key: Key, clef: Clef, s: PracticeSettings) {
  // Reading a treble note as if it were bass clef shifts it up two letters (and vice versa).
  const clefMisread = clef === 'treble' ? 2 : -2
  const pool: Weighted<Answer | null>[] = []

  if (c.kind === 'note') {
    const p = c.notes[0]
    const step = stepOf(p)
    pool.push({ item: { type: 'note', note: pc(inKey(step + 1, key)) }, weight: 3 })
    pool.push({ item: { type: 'note', note: pc(inKey(step - 1, key)) }, weight: 3 })
    pool.push({
      item: { type: 'note', note: pc(inKey(step + clefMisread, key)) },
      weight: 2,
    })
    pool.push({
      item: { type: 'note', note: pc(inKey(step - clefMisread, key)) },
      weight: 1,
    })
    // Missed the accidental: same letter as the key signature spells it.
    if (p.acc !== key.accidentals[p.letter]) {
      pool.push({ item: { type: 'note', note: pc(inKey(step, key)) }, weight: 5 })
    }
  }

  if (c.kind === 'dyad') {
    const [low, high] = c.notes
    const lo = stepOf(low)
    const hi = stepOf(high)
    for (const d of [1, -1]) {
      pool.push({ item: dyadAnswer(inKey(lo + d, key), inKey(hi + d, key)), weight: 3 })
      pool.push({ item: dyadAnswer(low, inKey(hi + d, key)), weight: 3 })
    }
    pool.push({
      item: dyadAnswer(inKey(lo + clefMisread, key), inKey(hi + clefMisread, key)),
      weight: 2,
    })
    if (s.accidentals) {
      // Same letters, different quality (e.g. Major 3rd vs Minor 3rd).
      const keyHigh = inKey(hi, key)
      if (keyHigh.acc !== high.acc)
        pool.push({ item: dyadAnswer(low, keyHigh), weight: 5 })
      else
        chromaticVariants(high, key).forEach((v) =>
          pool.push({ item: dyadAnswer(low, v), weight: 2 }),
        )
    }
  }

  if (c.kind === 'triad' && c.triad) {
    const { root, quality, inversion } = c.triad
    const rootStep = stepOf(root)
    pool.push({ item: diatonicTriadAnswer(rootStep + 1, key), weight: 3 })
    pool.push({ item: diatonicTriadAnswer(rootStep - 1, key), weight: 3 })
    pool.push({ item: diatonicTriadAnswer(rootStep + clefMisread, key), weight: 2 })
    if (inversion > 0) {
      // Classic inversion mistake: naming the chord after its bottom note.
      const bottom = c.notes[0]
      pool.push({ item: triadAnswer(bottom, quality, key), weight: 3 })
      pool.push({ item: diatonicTriadAnswer(stepOf(bottom), key), weight: 3 })
    }
    const isDiatonic = DIATONIC_QUALITIES[degreeOf(root.letter, key)] === quality
    if (s.accidentals || s.extraChords || !isDiatonic) {
      const swap = QUALITY_SWAPS[quality]
      if (swap) pool.push({ item: triadAnswer(root, swap, key), weight: 4 })
    }
  }

  return pool.filter((w): w is Weighted<Answer> => !!w.item)
}

function chooseDistractors(
  correct: Answer,
  pool: Weighted<Answer>[],
  count: number,
  random: () => number,
): Answer[] {
  const seen = new Set([answerId(correct)])
  const remaining = pool.filter((w) => {
    const id = answerId(w.item)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  const chosen: Answer[] = []
  while (chosen.length < count && remaining.length > 0) {
    const pick = pickWeighted(remaining, random)!
    chosen.push(pick)
    remaining.splice(
      remaining.findIndex((w) => w.item === pick),
      1,
    )
  }
  return chosen
}

// ---------------------------------------------------------------------------
// Settings → choices

export function allowedKeys(s: PracticeSettings): number[] {
  const out = [0]
  for (let n = 1; n <= s.maxKeyAccidentals; n++) {
    if (s.sharpKeys) out.push(n)
    if (s.flatKeys) out.push(-n)
  }
  return out
}

function rangeFor(
  kind: QuestionKind,
  clef: Clef,
  s: PracticeSettings,
  random: () => number,
): StepRange {
  if (s.rangeMode !== 'positions') return spanRange(clef, s.rangeMode)
  const positions = s.positions.length ? s.positions : (['C'] as const)
  if (kind === 'triad') {
    // A triad rarely fits under one hand position, so allow the span the positions cover.
    const ranges = positions.map((p) => positionRange(clef, p))
    return {
      low: Math.min(...ranges.map((r) => r.low)),
      high: Math.max(...ranges.map((r) => r.high)),
    }
  }
  return positionRange(clef, positions[Math.floor(random() * positions.length)])
}

const BUILDERS = { note: noteCandidates, dyad: dyadCandidates, triad: triadCandidates }

let counter = 0

export function generateQuestion(
  s: PracticeSettings,
  opts: GenerateOptions = {},
): Question {
  const random = opts.random ?? Math.random
  const weightOf = opts.weight ?? (() => 1)

  const kinds = (Object.keys(s.kinds) as QuestionKind[]).filter((k) => s.kinds[k])
  const kind: QuestionKind = kinds.length
    ? kinds[Math.floor(random() * kinds.length)]
    : 'note'
  const clef: Clef = s.clef === 'both' ? (random() < 0.5 ? 'treble' : 'bass') : s.clef
  const keys = allowedKeys(s)
  const key = majorKey(keys[Math.floor(random() * keys.length)])

  let candidates = BUILDERS[kind](rangeFor(kind, clef, s, random), key, s, clef)
  // Settings can conflict (e.g. octaves inside a five-note position): widen the range.
  if (!candidates.length)
    candidates = BUILDERS[kind](spanRange(clef, 'ledger1'), key, s, clef)
  if (!candidates.length)
    candidates = noteCandidates(spanRange(clef, 'staff'), key, s, clef)

  const fresh = candidates.filter((c) => c.statKey !== opts.previousStatKey)
  const pool = (fresh.length ? fresh : candidates).map((c) => ({
    item: c,
    weight: c.weight * weightOf(c.statKey),
  }))
  const chosen = pickWeighted(pool, random) ?? candidates[0]

  const distractors = chooseDistractors(
    chosen.answer,
    distractorPool(chosen, key, clef, s),
    2,
    random,
  )
  // Rare: not enough plausible mistakes. Borrow answers from other candidates.
  for (const c of shuffle(candidates, random)) {
    if (distractors.length >= 2) break
    const ids = [chosen.answer, ...distractors].map(answerId)
    if (!ids.includes(answerId(c.answer))) distractors.push(c.answer)
  }
  const choices = shuffle([chosen.answer, ...distractors], random)

  return {
    id: `q${++counter}`,
    statKey: chosen.statKey,
    kind: chosen.kind,
    clef,
    key,
    notes: chosen.notes,
    choices,
    correctIndex: choices.indexOf(chosen.answer),
  }
}
