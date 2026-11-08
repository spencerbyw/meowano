import {
  IconChartBar,
  IconChevronRight,
  IconInfinity,
  IconPlayerPlayFilled,
} from '@tabler/icons-react'
import { ToggleGroup } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Confetti } from '../components/Confetti'
import { Footer } from '../components/Footer'
import { unlockAudio } from '../audio/engine'
import { Logo } from '../components/Logo'
import { SettingsButton } from '../components/settings/SettingsButton'
import { Splash } from '../components/Splash'
import { Button3D } from '../components/ui/Button3D'
import { useQuiz } from '../quiz/store'
import { useSettings } from '../settings/store'
import { QUIZ_LENGTHS, type QuizLength } from '../settings/types'
import { useUi } from '../ui/store'
import styles from './StartScreen.module.css'

export function StartScreen() {
  const { t } = useTranslation()
  const { quizLength, setQuizLength, preset, catMode } = useSettings()
  const start = useQuiz((s) => s.start)
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)
  const showStats = useQuiz((s) => s.showStats)
  const pet = usePetting()

  return (
    <div
      className={['screen-frame', styles.screen, catMode && styles.paws]
        .filter(Boolean)
        .join(' ')}
    >
      <SettingsButton className={styles.settings} />
      <div className="scroll-area">
        <main className={styles.main}>
          <h1 className={styles.hero}>
            <Logo
              mood={pet.happy ? 'happy' : 'idle'}
              onCatClick={pet.onPet}
              catLabel={t('app.petCat')}
              catClassName={
                pet.pets === 0 ? undefined : pet.pets % 2 ? styles.purrA : styles.purrB
              }
            />
            <span className="visually-hidden"> — {t('app.tagline')}</span>
            <Splash className={styles.splash} />
          </h1>

          <section className={styles.panel}>
            <h2 id="length-label" className={styles.label}>
              {t('start.howMany')}
            </h2>
            <ToggleGroup.Root
              type="single"
              aria-labelledby="length-label"
              className={styles.lengths}
              value={String(quizLength)}
              onValueChange={(v) => v && setQuizLength(Number(v) as QuizLength)}
            >
              {QUIZ_LENGTHS.map((n) => (
                <ToggleGroup.Item
                  key={n}
                  value={String(n)}
                  className={styles.length}
                  aria-label={n === 0 ? t('start.unlimited') : String(n)}
                >
                  {n === 0 ? (
                    <IconInfinity size={28} stroke={2.5} aria-hidden="true" />
                  ) : (
                    n
                  )}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>

            <button
              type="button"
              className={styles.level}
              onClick={() => setSettingsOpen(true)}
            >
              {t('start.level')}: <strong>{t(`presets.${preset}`)}</strong>
              <IconChevronRight size={18} aria-hidden="true" />
            </button>

            <Button3D
              size="lg"
              className={styles.play}
              onClick={() => {
                if (useSettings.getState().sound) unlockAudio()
                start()
              }}
            >
              <IconPlayerPlayFilled size={24} aria-hidden="true" />
              {t('start.play')}
            </Button3D>
          </section>

          <Button3D
            variant="ghost"
            size="sm"
            className={styles.statsButton}
            onClick={showStats}
          >
            <IconChartBar size={20} aria-hidden="true" />
            {t('stats.open')}
          </Button3D>
        </main>
      </div>
      <Footer />
      {pet.parties > 0 && <Confetti key={pet.parties} />}
    </div>
  )
}

const HAPPY_MS = 1400
/** Taps further apart than this start the count over. */
const STREAK_GAP_MS = 1200
const PETS_FOR_CONFETTI = 5

/**
 * Easter egg: tapping the cat makes it happy and wiggle; five quick taps in a row
 * set off the confetti (handy for checking it without playing a whole round).
 */
function usePetting() {
  const [pets, setPets] = useState(0)
  const [happy, setHappy] = useState(false)
  const [parties, setParties] = useState(0)
  const streak = useRef({ count: 0, last: 0 })
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onPet = () => {
    const now = Date.now()
    const s = streak.current
    s.count = now - s.last <= STREAK_GAP_MS ? s.count + 1 : 1
    s.last = now
    if (s.count >= PETS_FOR_CONFETTI) {
      s.count = 0
      setParties((n) => n + 1)
    }
    setPets((n) => n + 1)
    setHappy(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHappy(false), HAPPY_MS)
  }

  return { pets, happy, parties, onPet }
}
