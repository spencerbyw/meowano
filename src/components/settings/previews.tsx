import { useTranslation } from 'react-i18next'
import { formatKeyName } from '../../music/format'
import { positionRange, spanRange, type Clef, type StepRange } from '../../music/ranges'
import {
  DIATONIC_QUALITIES,
  buildTriad,
  inKey,
  majorKey,
  stepOf,
  type Pitch,
} from '../../music/theory'
import type { PracticeSettings } from '../../settings/types'
import { Staff } from '../Staff'
import styles from './previews.module.css'

const C = majorKey(0)

const clefsFor = (s: PracticeSettings): Clef[] =>
  s.clef === 'both' ? ['treble', 'bass'] : [s.clef]

function rangeOf(clef: Clef, s: PracticeSettings): StepRange {
  if (s.rangeMode !== 'positions') return spanRange(clef, s.rangeMode)
  const ranges = (s.positions.length ? s.positions : (['C'] as const)).map((p) =>
    positionRange(clef, p),
  )
  return {
    low: Math.min(...ranges.map((r) => r.low)),
    high: Math.max(...ranges.map((r) => r.high)),
  }
}

/** Every note in the range when it's small, otherwise just the lowest and highest. */
function rangeNotes(range: StepRange): Pitch[][] {
  const count = range.high - range.low + 1
  if (count > 9) return [[inKey(range.low, C)], [inKey(range.high, C)]]
  return Array.from({ length: count }, (_, i) => [inKey(range.low + i, C)])
}

export function RangePreview({ settings }: { settings: PracticeSettings }) {
  const { t } = useTranslation()
  return (
    <div className={styles.row}>
      {clefsFor(settings).map((clef) => (
        <Staff
          key={clef}
          className={styles.staff}
          clef={clef}
          chords={rangeNotes(rangeOf(clef, settings))}
          label={t(`clefs.${clef}`)}
        />
      ))}
    </div>
  )
}

export function KeyPreview({ settings }: { settings: PracticeSettings }) {
  const { t } = useTranslation()
  const n = settings.maxKeyAccidentals
  const keys =
    n === 0
      ? [0]
      : [...(settings.sharpKeys ? [n] : []), ...(settings.flatKeys ? [-n] : [])]
  return (
    <div className={styles.row}>
      {(keys.length ? keys : [0]).map((fifths) => {
        const key = majorKey(fifths)
        return (
          <figure key={fifths} className={styles.figure}>
            <Staff
              className={styles.staff}
              clef="treble"
              keySignature={key}
              label={key.name}
            />
            <figcaption className={styles.caption}>
              {t('chords.major', { root: formatKeyName(t, key) })}
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}

export function ChordPreview({ settings }: { settings: PracticeSettings }) {
  const { t } = useTranslation()
  const degrees = settings.triadSet === 'primary' ? [0, 3, 4] : [0, 1, 2, 3, 4, 5, 6]
  const c4 = stepOf({ letter: 'C', acc: '', octave: 4 })
  const chords = degrees
    .map((d) => buildTriad(inKey(c4 + d, C), DIATONIC_QUALITIES[d]))
    .filter((c): c is Pitch[] => !!c)
  return (
    <div className={styles.row}>
      <Staff
        className={styles.staff}
        clef="treble"
        chords={chords}
        label={t('settings.chordSet')}
      />
    </div>
  )
}
