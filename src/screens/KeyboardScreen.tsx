import { IconArrowLeft } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { setPianoRoom, unlockAudio, useAudioStatus } from '../audio/engine'
import { PeekCat } from '../components/PeekCat'
import { usePlaying, useKeyView } from '../components/keyboard/hooks'
import { KeyNav, Keys } from '../components/keyboard/Keys'
import { MIDDLE_C, whiteIndex } from '../components/keyboard/notes'
import { Button3D } from '../components/ui/Button3D'
import { useQuiz } from '../quiz/store'
import { useMediaQuery } from '../ui/useMediaQuery'
import styles from './KeyboardScreen.module.css'

/** About how wide a white key should be (px): comfortable for a fingertip. */
const KEY_W = 56

/** Phones held upright: the keyboard turns sideways (it needs the long side). */
const SIDEWAYS = '(orientation: portrait) and (max-width: 599px)'

export function KeyboardScreen() {
  const { t } = useTranslation()
  const goHome = useQuiz((s) => s.goHome)
  const piano = useAudioStatus((s) => s.piano)
  const sideways = useMediaQuery(SIDEWAYS)
  // Starts on middle C (or as near as fits).
  const view = useKeyView(KEY_W, () => whiteIndex(MIDDLE_C))
  const pressed = usePlaying(view.keysEl)

  // Start loading the piano now (opening this screen was a tap), and play it in
  // the room, so held notes keep ringing.
  useEffect(() => {
    unlockAudio()
    setPianoRoom(true)
    return () => setPianoRoom(false)
  }, [])

  return (
    <div className={`screen-frame ${styles.screen} ${sideways ? styles.sideways : ''}`}>
      <h1 className="visually-hidden">{t('keyboard.title')}</h1>
      <header className={styles.top}>
        <Button3D
          variant="ghost"
          size="sm"
          onClick={goHome}
          aria-label={t('toybox.back')}
        >
          <IconArrowLeft size={22} aria-hidden="true" />
        </Button3D>
        <KeyNav view={view} sideways={sideways} className={styles.nav} />
      </header>

      <main className={styles.main}>
        <div className={styles.piano}>
          <PeekCat
            className={styles.cat}
            mood={pressed.size ? 'listening' : 'idle'}
            sleepy={!pressed.size}
          />
          <div className={styles.lid}>
            {piano === 'loading' && (
              <span className={styles.status}>{t('keyboard.loading')}</span>
            )}
            {piano === 'error' && (
              <span className={styles.status}>{t('keyboard.error')}</span>
            )}
          </div>
          <Keys
            view={view}
            pressed={pressed}
            label={t('keyboard.keys')}
            className={styles.keys}
          />
        </div>
      </main>
    </div>
  )
}
