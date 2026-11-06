import { IconChevronRight, IconInfinity, IconPlayerPlayFilled } from '@tabler/icons-react'
import { ToggleGroup } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { Footer } from '../components/Footer'
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
  const { quizLength, setQuizLength, preset } = useSettings()
  const start = useQuiz((s) => s.start)
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)

  return (
    <div className={styles.screen}>
      <SettingsButton className={styles.settings} />
      <main className={styles.main}>
        <h1 className={styles.hero}>
          <Logo />
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
                {n === 0 ? <IconInfinity size={28} stroke={2.5} aria-hidden="true" /> : n}
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

          <Button3D size="lg" className={styles.play} onClick={start}>
            <IconPlayerPlayFilled size={24} aria-hidden="true" />
            {t('start.play')}
          </Button3D>
        </section>
      </main>
      <Footer />
    </div>
  )
}
