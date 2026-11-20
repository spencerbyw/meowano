import { IconMicrophone } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatPitchClass } from '../music/format'
import type { Clef } from '../music/ranges'
import { midiOf, type Pitch } from '../music/theory'
import { useSettings } from '../settings/store'
import { usePlaying, useKeyView } from './keyboard/hooks'
import { KeyNav, Keys, type KeyMark } from './keyboard/Keys'
import { MIDDLE_C, whiteIndex } from './keyboard/notes'
import { Button3D } from './ui/Button3D'
import styles from './PlayKeyboard.module.css'

/** A white key's width here (px): narrower than the toybox's, to fit an octave and more. */
const KEY_W = 44

/**
 * "Play the note" without a piano: a keyboard on screen. Each question starts with
 * middle C at the edge its clef reads from (treble up, bass down). One finger at
 * a time, and no octave labels: finding the note is the point. Wrong keys turn
 * red, and the right one green with its name.
 */
export function PlayKeyboard({
  questionId,
  clef,
  answer,
  wrongNotes,
  solved,
  onPress,
  onUseMic,
}: {
  questionId: string
  clef: Clef
  answer: Pitch
  wrongNotes: number[]
  solved: boolean
  onPress: (midi: number) => void
  onUseMic: () => void
}) {
  const { t } = useTranslation()
  const sound = useSettings((s) => s.sound)
  const c4 = whiteIndex(MIDDLE_C)
  const answerMidi = midiOf(answer)
  // Each question starts at its clef's place; once answered (or given up), the
  // right key slides into view if it's off screen.
  const view = useKeyView(KEY_W, (visible) => (clef === 'bass' ? c4 - visible + 1 : c4), {
    homeKey: questionId,
    show: solved ? answerMidi : undefined,
  })
  const pressed = usePlaying(view.keysEl, { glide: false, single: true, sound, onPress })

  const marks = useMemo(() => {
    const m = new Map<number, KeyMark>(wrongNotes.map((n) => [n, 'wrong']))
    if (solved) m.set(answerMidi, 'right')
    return m
  }, [wrongNotes, solved, answerMidi])

  return (
    <div className={styles.panel}>
      <div className={styles.bar}>
        <KeyNav view={view} className={styles.nav} />
        <Button3D
          variant="ghost"
          size="sm"
          aria-label={t('listen.useMic')}
          onClick={onUseMic}
        >
          <IconMicrophone size={22} aria-hidden="true" />
        </Button3D>
      </div>
      <div className={styles.body}>
        <Keys
          view={view}
          pressed={pressed}
          marks={marks}
          octaveLabels={false}
          named={
            solved
              ? {
                  midi: answerMidi,
                  text: `${formatPitchClass(t, answer)}${answer.octave}`,
                }
              : undefined
          }
          label={t('listen.keys')}
          className={styles.keys}
        />
      </div>
    </div>
  )
}
