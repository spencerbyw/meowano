export type ClefSetting = 'treble' | 'bass' | 'both'
export type QuestionKind = 'note' | 'dyad' | 'triad'

/** Five-finger hand positions, named by the note under the thumb (RH) / pinky (LH). */
export type PositionId = 'C' | 'D' | 'F' | 'G' | 'A'

/**
 * - positions: notes stay inside the selected five-finger positions
 * - staff: lines and spaces of the staff (plus the notes just above and below)
 * - ledger1 / ledger2: up to one / two ledger lines beyond the staff
 */
export type RangeMode = 'positions' | 'staff' | 'ledger1' | 'ledger2'

export type TriadSet = 'primary' | 'diatonic'

export type PresetId = 'newbie' | 'beginner' | 'intermediate' | 'experienced' | 'anything'

export interface PracticeSettings {
  clef: ClefSetting
  kinds: Record<QuestionKind, boolean>
  rangeMode: RangeMode
  positions: PositionId[]
  /** Most sharps or flats a key signature may have (0–7). */
  maxKeyAccidentals: number
  sharpKeys: boolean
  flatKeys: boolean
  /** Allow notes outside the key, written with accidentals (♯, ♭, ♮). */
  accidentals: boolean
  /** Interval sizes allowed for dyads, 2 (2nd) through 8 (octave). */
  intervals: number[]
  triadSet: TriadSet
  inversions: boolean
  /** Add sus2, sus4, augmented and diminished triads on any scale degree. */
  extraChords: boolean
}

export type ThemeSetting = 'system' | 'light' | 'dark'
export type ConfirmMode = 'single' | 'double'
