import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Footer } from './components/Footer'
import { Staff } from './components/Staff'
import { formatAnswer, formatPitchClass } from './music/format'
import { generateQuestion, type Question } from './music/generator'
import { PRESET_ORDER } from './settings/presets'
import { useSettings } from './settings/store'
import type { PresetId, ThemeSetting } from './settings/types'
import { useApplyTheme } from './settings/useTheme'
import styles from './App.module.css'

/**
 * Temporary preview screen for the music engine + staff.
 * Replaced by the start screen and quiz loop in the next phases.
 */
export default function App() {
  useApplyTheme()
  const { t } = useTranslation()
  const { practice, preset, applyPreset, theme, setTheme } = useSettings()
  const [question, setQuestion] = useState<Question>(() => generateQuestion(practice))
  const [picked, setPicked] = useState<number | null>(null)

  const next = (prev?: Question) => {
    setPicked(null)
    setQuestion(
      generateQuestion(useSettings.getState().practice, {
        previousStatKey: prev?.statKey,
      }),
    )
  }

  const staffLabel = useMemo(
    () =>
      t('staff.label', {
        clef: t(`clefs.${question.clef}`),
        key: formatPitchClass(t, {
          letter: question.key.tonic,
          acc: question.key.name.slice(1) as '',
        }),
        notes: question.notes.map((n) => formatPitchClass(t, n)).join(', '),
      }),
    [question, t],
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.logo}>{t('app.name')}</h1>
        <p className={styles.splash}>{t('app.tagline')}</p>
      </header>

      <div className={styles.devBar}>
        <select
          value={preset}
          onChange={(e) => {
            applyPreset(e.target.value as PresetId)
            next(question)
          }}
        >
          {preset === 'custom' && <option value="custom">custom</option>}
          {PRESET_ORDER.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeSetting)}>
          <option>system</option>
          <option>light</option>
          <option>dark</option>
        </select>
      </div>

      <main className={styles.main}>
        <div className={styles.card}>
          <Staff
            clef={question.clef}
            keySignature={question.key}
            notes={question.notes}
            label={staffLabel}
          />
        </div>

        <ol className={styles.choices}>
          {question.choices.map((choice, i) => {
            const { label, detail } = formatAnswer(t, choice)
            const state =
              picked === null
                ? ''
                : i === question.correctIndex
                  ? styles.right
                  : i === picked
                    ? styles.wrong
                    : ''
            return (
              <li key={i}>
                <button
                  className={`${styles.choice} ${state}`}
                  onClick={() => setPicked(i)}
                >
                  <span className={styles.label}>{label}</span>
                  {detail && <span className={styles.detail}>{detail}</span>}
                </button>
              </li>
            )
          })}
        </ol>

        <button className={styles.next} onClick={() => next(question)}>
          {t('preview.next')}
        </button>
        <code className={styles.debug}>{question.statKey}</code>
      </main>

      <Footer />
    </div>
  )
}
