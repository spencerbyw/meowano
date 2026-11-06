import type { PositionId, RangeMode } from '../settings/types'
import { parsePitch, stepOf } from './theory'

export type Clef = 'treble' | 'bass'

export interface StepRange {
  low: number
  high: number
}

const span = (low: string, high: string): StepRange => ({
  low: stepOf(parsePitch(low)),
  high: stepOf(parsePitch(high)),
})

/** Lowest note of each five-finger position, per clef (RH for treble, LH for bass). */
const POSITION_ROOTS: Record<Clef, Record<PositionId, string>> = {
  treble: { C: 'C4', D: 'D4', F: 'F4', G: 'G4', A: 'A4' },
  bass: { C: 'C3', D: 'D3', F: 'F3', G: 'G2', A: 'A2' },
}

export function positionRange(clef: Clef, position: PositionId): StepRange {
  const low = stepOf(parsePitch(POSITION_ROOTS[clef][position]))
  return { low, high: low + 4 }
}

const SPANS: Record<Exclude<RangeMode, 'positions'>, Record<Clef, StepRange>> = {
  staff: { treble: span('D4', 'G5'), bass: span('F2', 'B3') },
  ledger1: { treble: span('B3', 'B5'), bass: span('D2', 'D4') },
  ledger2: { treble: span('G3', 'D6'), bass: span('B1', 'F4') },
}

export function spanRange(clef: Clef, mode: Exclude<RangeMode, 'positions'>): StepRange {
  return SPANS[mode][clef]
}
