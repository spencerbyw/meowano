import type { PracticeSettings } from '../settings/types'
import { positionRange, spanRange, type Clef } from './ranges'
import { parsePitch, stepOf, type Pitch } from './theory'

/**
 * How much of the drawing to show above and below the staff. Everything is in
 * VexFlow units: the top staff line is at y=50, the bottom at y=90, 5 units per
 * step (line to space).
 */
export interface StaffBand {
  top: number
  bottom: number
}

export const STAFF_TOP = 50
export const STAFF_BOTTOM = 90
const PAD = 4

const BOTTOM_LINE: Record<Clef, number> = {
  treble: stepOf(parsePitch('E4')),
  bass: stepOf(parsePitch('G2')),
}

export const yOfStep = (clef: Clef, step: number) =>
  STAFF_BOTTOM - (step - BOTTOM_LINE[clef]) * 5

/** Room the clef and key signature need (measured from Bravura at VexFlow's size). */
function glyphBand(clef: Clef, manySharps: boolean): StaffBand {
  return clef === 'treble'
    ? { top: manySharps ? 31 : 36, bottom: 106 } // treble clef curls below the staff
    : { top: manySharps ? 41 : 47, bottom: 88 }
}

const union = (a: StaffBand, b: StaffBand): StaffBand => ({
  top: Math.min(a.top, b.top),
  bottom: Math.max(a.bottom, b.bottom),
})

/** Just the clef, key signature and staff (no notes yet). */
export function baseBand(clef: Clef, keyAccidentals = 1): StaffBand {
  return glyphBand(clef, keyAccidentals >= 3)
}

/** Extend a band to fit some notes (with room for an accidental above each). */
export function bandWithNotes(clef: Clef, band: StaffBand, notes: Pitch[]): StaffBand {
  return notes.reduce((b, p) => {
    const y = yOfStep(clef, stepOf(p))
    return union(b, { top: y - (p.acc ? 17 : 6), bottom: y + 6 })
  }, band)
}

/**
 * One band for the whole practice session, covering every note the settings can
 * ask for in either clef, so the staff doesn't change size between questions.
 */
export function practiceBand(s: PracticeSettings): StaffBand {
  const clefs: Clef[] = s.clef === 'both' ? ['treble', 'bass'] : [s.clef]
  const manySharps = s.sharpKeys && s.maxKeyAccidentals >= 3
  return clefs.reduce<StaffBand>(
    (band, clef) => {
      const ranges =
        s.rangeMode === 'positions'
          ? s.positions.map((p) => positionRange(clef, p))
          : [spanRange(clef, s.rangeMode)]
      const low = Math.min(...ranges.map((r) => r.low))
      const high = Math.max(...ranges.map((r) => r.high))
      // Notes may carry an accidental (key or extra), so leave room above the top one.
      const notes = union(glyphBand(clef, manySharps), {
        top: yOfStep(clef, high) - 17,
        bottom: yOfStep(clef, low) + 6,
      })
      return union(band, notes)
    },
    { top: STAFF_TOP, bottom: STAFF_BOTTOM },
  )
}

/** Adds the breathing room around a band and returns the viewBox's top and height. */
export const viewOf = (band: StaffBand) => ({
  top: band.top - PAD,
  height: band.bottom - band.top + PAD * 2,
})
