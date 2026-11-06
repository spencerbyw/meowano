import type { TFunction } from 'i18next'
import type { Answer, PitchClass, Question } from './generator'
import type { Accidental, Key, Pitch } from './theory'

export const formatPitchClass = (t: TFunction, p: PitchClass | Pitch) =>
  `${t(`notes.${p.letter}`)}${t(`accidentals.${p.acc}`)}`

const joinNotes = (t: TFunction, notes: PitchClass[]) =>
  notes.map((n) => formatPitchClass(t, n)).join('–')

/** Main label + optional detail line for an answer button. */
export function formatAnswer(
  t: TFunction,
  a: Answer,
): { label: string; detail?: string } {
  switch (a.type) {
    case 'note':
      return { label: formatPitchClass(t, a.note) }
    case 'dyad':
      return {
        label: t(`intervals.${a.interval}` as 'intervals.M3'),
        detail: joinNotes(t, a.notes),
      }
    case 'triad':
      return {
        label: t(`chords.${a.quality}`, { root: formatPitchClass(t, a.root) }),
        detail: joinNotes(t, a.notes),
      }
  }
}

/** "F♯" for the key of F# major. */
export const formatKeyName = (t: TFunction, key: Key) =>
  formatPitchClass(t, { letter: key.tonic, acc: key.name.slice(1) as Accidental })

/** Screen-reader description of what's on the staff. */
export const formatStaffLabel = (t: TFunction, q: Question) =>
  t('staff.label', {
    clef: t(`clefs.${q.clef}`),
    key: formatKeyName(t, q.key),
    notes: q.notes.map((n) => formatPitchClass(t, n)).join(', '),
  })
