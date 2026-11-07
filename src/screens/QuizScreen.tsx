import {
  IconArrowRight,
  IconCheck,
  IconFlag,
  IconFlame,
  IconLoader2,
  IconMusic,
  IconVolume,
  IconX,
} from '@tabler/icons-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { playChime, playNotes, useAudioStatus } from '../audio/engine'
import { CatMark, type CatMood } from '../components/Logo'
import { SettingsButton } from '../components/settings/SettingsButton'
import { Staff } from '../components/Staff'
import { Button3D, type ButtonVariant } from '../components/ui/Button3D'
import { formatAnswer, formatStaffLabel } from '../music/format'
import { useQuiz } from '../quiz/store'
import { useSettings } from '../settings/store'
import { useStats } from '../stats/store'
import { useWakeLock } from '../ui/useWakeLock'
import styles from './QuizScreen.module.css'

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

export function QuizScreen() {
  const { t } = useTranslation()
  const { question, wrongPicks, solved, results, length } = useQuiz()
  const currentStreak = useStats((s) => s.currentStreak)
  const allTimeBest = useStats((s) => s.bestStreak)
  const { answer, next, finish, goHome } = useQuiz()
  const { confirm, catMode, sound } = useSettings()
  useWakeLock(true)
  const pianoStatus = useAudioStatus((s) => s.piano)
  // Bumped on each tap of the staff to restart the little "ring" animation.
  const [rings, setRings] = useState(0)

  const hear = () => {
    if (!question) return
    setRings((n) => n + 1)
    void playNotes(question.notes)
  }

  // Index awaiting a second tap when "double tap to confirm" is on.
  const [pending, setPending] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<{
    kind: 'correct' | 'wrong'
    text: string
  } | null>(null)
  const [shake, setShake] = useState<number | null>(null)
  const promptRef = useRef<HTMLParagraphElement>(null)
  const mood: CatMood = !feedback
    ? 'idle'
    : feedback.kind === 'correct'
      ? 'happy'
      : 'surprised'

  const staffLabel = useMemo(
    () => (question ? formatStaffLabel(t, question) : ''),
    [question, t],
  )
  if (!question) return null

  const current = results.length + (solved ? 0 : 1)
  const isLast = length > 0 && results.length >= length

  const onNext = () => {
    setPending(null)
    setFeedback(null)
    next()
    // The Next button disappears, so move focus to the new question's prompt.
    requestAnimationFrame(() => promptRef.current?.focus())
  }

  const onChoice = (i: number) => {
    if (solved || wrongPicks.includes(i)) return
    if (confirm === 'double' && pending !== i) {
      setPending(i)
      return
    }
    setPending(null)
    const outcome = answer(i)
    if (sound && outcome !== 'ignored') playChime(outcome)
    if (outcome === 'correct') {
      const praise = t(catMode ? 'quiz.praiseCat' : 'quiz.praise', {
        returnObjects: true,
      }) as string[]
      setFeedback({ kind: 'correct', text: pick(praise) })
    } else if (outcome === 'wrong') {
      setFeedback({
        kind: 'wrong',
        text: t(catMode ? 'quiz.tryAgainCat' : 'quiz.tryAgain'),
      })
      setShake(i)
    }
  }

  const variantFor = (i: number): ButtonVariant => {
    if (solved && i === question.correctIndex) return 'success'
    if (wrongPicks.includes(i)) return 'error'
    if (pending === i) return 'pending'
    return 'choice'
  }

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <Button3D variant="ghost" size="sm" onClick={goHome} aria-label={t('quiz.quit')}>
          <IconX size={22} aria-hidden="true" />
        </Button3D>

        <div className={styles.progress}>
          <span className={styles.progressText}>
            {length > 0
              ? t('quiz.progress', { current, total: length })
              : t('quiz.progressUnlimited', { current })}
          </span>
          {length > 0 && (
            <span className={styles.bar} aria-hidden="true">
              <span
                className={styles.barFill}
                style={{ width: `${(results.length / length) * 100}%` }}
              />
            </span>
          )}
        </div>

        <div
          className={styles.streak}
          role="status"
          aria-label={t('quiz.streakLabel', { count: currentStreak, best: allTimeBest })}
        >
          <span className={styles.streakNow} aria-hidden="true">
            <IconFlame size={20} />
            {currentStreak}
          </span>
          <span className={styles.streakBest} aria-hidden="true">
            {t('quiz.best', { count: allTimeBest })}
          </span>
        </div>
        <SettingsButton />
      </header>

      <main className={styles.main}>
        <p className="visually-hidden" aria-live="polite">
          {length > 0
            ? t('quiz.progress', { current, total: length })
            : t('quiz.progressUnlimited', { current })}
          . {t(`quiz.prompt.${question.kind}`)}
        </p>
        <section className={styles.staffCard}>
          <div className={styles.cardHead}>
            <span
              key={`${mood}-${results.length}-${wrongPicks.length}`}
              className={[styles.mascot, mood !== 'idle' && styles.react]
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
            >
              {catMode ? (
                <CatMark size={44} mood={mood} />
              ) : (
                <IconMusic size={28} stroke={2.2} />
              )}
            </span>
            <p ref={promptRef} tabIndex={-1} className={styles.prompt}>
              {t(`quiz.prompt.${question.kind}`)}
            </p>
          </div>
          {sound ? (
            <button
              type="button"
              className={styles.staffButton}
              onClick={hear}
              aria-label={`${staffLabel}. ${t('quiz.hear')}`}
            >
              <div key={question.id} className={styles.staffIn}>
                <Staff
                  clef={question.clef}
                  keySignature={question.key}
                  notes={question.notes}
                  label={staffLabel}
                />
              </div>
              <span
                key={`ring-${rings}`}
                className={[styles.hearHint, rings > 0 && styles.ringing]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              >
                {pianoStatus === 'loading' && rings > 0 ? (
                  <IconLoader2 size={18} className={styles.spin} />
                ) : (
                  <IconVolume size={18} />
                )}
                {pianoStatus === 'loading' && rings > 0
                  ? t('quiz.loadingPiano')
                  : pianoStatus === 'error'
                    ? t('quiz.pianoError')
                    : t('quiz.hear')}
              </span>
            </button>
          ) : (
            <div key={question.id} className={styles.staffIn}>
              <Staff
                clef={question.clef}
                keySignature={question.key}
                notes={question.notes}
                label={staffLabel}
              />
            </div>
          )}
        </section>

        <section className={styles.answers}>
          <ol className={styles.choices}>
            {question.choices.map((choice, i) => {
              const { label, detail } = formatAnswer(t, choice)
              const variant = variantFor(i)
              const dimmed = solved && i !== question.correctIndex
              return (
                <li key={`${question.id}-${i}`}>
                  <Button3D
                    variant={variant}
                    size="lg"
                    className={[
                      styles.choice,
                      dimmed && styles.dimmed,
                      shake === i && variant === 'error' && styles.shake,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    frontClassName={styles.choiceFront}
                    pressed={variant === 'error' || variant === 'success'}
                    disabled={solved || wrongPicks.includes(i)}
                    aria-describedby={pending === i ? 'confirm-hint' : undefined}
                    onClick={() => onChoice(i)}
                    onAnimationEnd={() => setShake(null)}
                  >
                    <span className={styles.choiceIcon} aria-hidden="true">
                      {variant === 'success' && <IconCheck size={28} stroke={3} />}
                      {variant === 'error' && <IconX size={28} stroke={3} />}
                    </span>
                    <span className={styles.choiceText}>
                      <span className={styles.choiceLabel}>{label}</span>
                      {detail && <span className={styles.choiceDetail}>{detail}</span>}
                    </span>
                    <span className={styles.choiceIcon}>
                      {variant === 'pending' && (
                        <span className={styles.sure}>{t('quiz.confirm')}</span>
                      )}
                    </span>
                    {variant === 'error' && (
                      <span className="visually-hidden">, {t('quiz.wrong')}</span>
                    )}
                    {variant === 'success' && (
                      <span className="visually-hidden">, {t('quiz.correct')}</span>
                    )}
                  </Button3D>
                </li>
              )
            })}
          </ol>

          <div className={styles.footer}>
            <p
              className={[styles.feedback, feedback && styles[feedback.kind]]
                .filter(Boolean)
                .join(' ')}
              aria-live="polite"
              id="confirm-hint"
            >
              {feedback ? (
                <span
                  key={feedback.text + results.length + wrongPicks.length}
                  className={styles.pop}
                >
                  {feedback.kind === 'correct' ? (
                    <IconCheck size={22} stroke={3} aria-hidden="true" />
                  ) : (
                    <IconX size={22} stroke={3} aria-hidden="true" />
                  )}
                  {feedback.text}
                </span>
              ) : pending !== null ? (
                t('quiz.confirmHint')
              ) : null}
            </p>

            {solved ? (
              <Button3D size="lg" className={styles.next} onClick={onNext} autoFocus>
                {isLast ? t('quiz.finish') : t('quiz.next')}
                <IconArrowRight size={24} aria-hidden="true" />
              </Button3D>
            ) : (
              length === 0 &&
              results.length > 0 && (
                <Button3D
                  variant="ghost"
                  size="sm"
                  className={styles.next}
                  onClick={finish}
                >
                  <IconFlag size={18} aria-hidden="true" />
                  {t('quiz.end')}
                </Button3D>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
