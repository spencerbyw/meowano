import {
  IconArrowRight,
  IconCheck,
  IconFlag,
  IconFlame,
  IconHelp,
  IconLoader2,
  IconMusic,
  IconVolume,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { playChime, playNotes, useAudioStatus } from '../audio/engine'
import { onNotePlayed } from '../audio/mic'
import { ListenPanel } from '../components/ListenPanel'
import { CatMark, type CatMood } from '../components/Logo'
import { SettingsButton } from '../components/settings/SettingsButton'
import { PianoKeys } from '../components/PianoKeys'
import { Staff } from '../components/Staff'
import { Button3D, type ButtonVariant } from '../components/ui/Button3D'
import { formatAnswer, formatPitchClass, formatStaffLabel } from '../music/format'
import { practiceBand, viewOf } from '../music/staffBand'
import { midiOf, spellMidi } from '../music/theory'
import { useQuiz } from '../quiz/store'
import { useSettings } from '../settings/store'
import { useStats } from '../stats/store'
import { useWakeLock } from '../ui/useWakeLock'
import styles from './QuizScreen.module.css'

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

export function QuizScreen() {
  const { t } = useTranslation()
  const { question, wrongPicks, wrongNotes, solved, results, length, isReturn, mode } =
    useQuiz()
  const currentStreak = useStats((s) => s.currentStreak)
  const allTimeBest = useStats((s) => s.bestStreak)
  const { answer, next, skip, finish, goHome } = useQuiz()
  const { confirm, catMode, sound } = useSettings()
  const practice = useSettings((s) => s.practice)
  // One staff size for the whole session: tall enough for every note these
  // settings can produce, and wide enough for the biggest key signature.
  const staffFit = useMemo(() => {
    const band = practiceBand(practice)
    const width =
      146 +
      9 * practice.maxKeyAccidentals +
      (practice.accidentals || practice.kinds.triad ? 12 : 0)
    return { band, width, aspect: width / viewOf(band).height }
  }, [practice])
  useWakeLock(true)
  // Once answered, the answer area shrinks (the other choices fold away; in play
  // mode the listening panel gives way to the answer), which would let the staff
  // grow and the centred card slide down. Hold both where they were while she was
  // answering: measured after every render until then, since the swap is instant.
  const staffRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const lastLayout = useRef<{ staff: number; top: number } | null>(null)
  const [held, setHeld] = useState<{ staff: number; top: number } | null>(null)
  const measure = () => {
    const staff = staffRef.current
    const card = cardRef.current
    const area = card?.parentElement
    if (!staff || !card || !area) return null
    const top =
      card.getBoundingClientRect().top -
      area.getBoundingClientRect().top -
      parseFloat(getComputedStyle(area).paddingTop) +
      area.scrollTop
    return { staff: staff.offsetWidth, top }
  }
  useLayoutEffect(() => {
    if (!solved) lastLayout.current = measure()
  })
  useLayoutEffect(() => {
    setHeld(solved ? (lastLayout.current ?? measure()) : null)
  }, [solved])
  useEffect(() => {
    const onResize = () => {
      if (!useQuiz.getState().solved) lastLayout.current = measure()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const staffStyle = {
    '--staff-aspect': staffFit.aspect,
    ...(held ? { '--staff-cap': `${held.staff}px` } : {}),
  } as React.CSSProperties
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
    kind: 'correct' | 'wrong' | 'info'
    text: string
  } | null>(null)
  const [shake, setShake] = useState<number | null>(null)
  const promptRef = useRef<HTMLParagraphElement>(null)

  // "Play the note": judge each note the mic hears.
  useEffect(() => {
    if (mode !== 'play') return
    return onNotePlayed((midi) => {
      const quiz = useQuiz.getState()
      const q = quiz.question
      if (!q) return
      const outcome = quiz.answerNote(midi)
      if (outcome === 'ignored') return
      if (useSettings.getState().sound) void playChime(outcome)
      if (outcome === 'correct') {
        const praise = t(catMode ? 'quiz.praiseCat' : 'quiz.praise', {
          returnObjects: true,
        }) as string[]
        setFeedback({ kind: 'correct', text: pick(praise) })
      } else {
        const played = spellMidi(midi, q.key)
        setFeedback({
          kind: 'wrong',
          text: t(midi > midiOf(q.notes[0]) ? 'listen.tooHigh' : 'listen.tooLow', {
            note: `${formatPitchClass(t, played)}${played.octave}`,
          }),
        })
      }
    })
  }, [mode, catMode, t])
  const mood: CatMood =
    feedback?.kind === 'correct'
      ? 'happy'
      : feedback?.kind === 'wrong'
        ? 'surprised'
        : 'idle'

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

  const onDontKnow = () => {
    setPending(null)
    const outcome = skip()
    if (outcome === 'deferred') {
      setFeedback({
        kind: 'info',
        text: t(length > 0 ? 'quiz.skipped' : 'quiz.skippedUnlimited'),
      })
      requestAnimationFrame(() => promptRef.current?.focus())
    } else if (outcome === 'gaveUp') {
      const { label, detail } = formatAnswer(t, question.choices[question.correctIndex])
      setFeedback({
        kind: 'info',
        text: t('quiz.gaveUp', { answer: detail ? `${label} (${detail})` : label }),
      })
    }
  }

  const onChoice = (i: number) => {
    if (solved || wrongPicks.includes(i)) return
    if (confirm === 'double' && pending !== i) {
      setPending(i)
      return
    }
    setPending(null)
    const outcome = answer(i)
    if (sound && outcome !== 'ignored') void playChime(outcome)
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
    <div className={`screen-frame ${styles.screen}`}>
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
          . {t(mode === 'play' ? 'quiz.prompt.play' : `quiz.prompt.${question.kind}`)}
        </p>
        <div className={`scroll-area ${styles.staffArea}`}>
          <section
            ref={cardRef}
            className={styles.staffCard}
            style={
              held
                ? ({ '--card-top': `${held.top}px` } as React.CSSProperties)
                : undefined
            }
          >
            <div className={styles.cardHead}>
              <span
                key={`${mood}-${results.length}-${wrongPicks.length}`}
                className={[styles.mascot, mood !== 'idle' && styles.react]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              >
                {catMode ? (
                  <CatMark size={40} mood={mood} />
                ) : (
                  <IconMusic size={28} stroke={2.2} />
                )}
              </span>
              <p ref={promptRef} tabIndex={-1} className={styles.prompt}>
                {t(mode === 'play' ? 'quiz.prompt.play' : `quiz.prompt.${question.kind}`)}
              </p>
            </div>
            {sound ? (
              <button
                type="button"
                className={styles.staffButton}
                onClick={hear}
                aria-label={`${staffLabel}. ${t('quiz.hear')}`}
              >
                <div
                  key={question.id}
                  ref={staffRef}
                  className={styles.staffIn}
                  style={staffStyle}
                >
                  <Staff
                    clef={question.clef}
                    keySignature={question.key}
                    notes={question.notes}
                    band={staffFit.band}
                    width={staffFit.width}
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
              <div
                key={question.id}
                ref={staffRef}
                className={styles.staffIn}
                style={staffStyle}
              >
                <Staff
                  clef={question.clef}
                  keySignature={question.key}
                  notes={question.notes}
                  band={staffFit.band}
                  width={staffFit.width}
                  label={staffLabel}
                />
              </div>
            )}
            {solved && (
              <div className={styles.keysReveal}>
                <div>
                  <PianoKeys notes={question.notes} t={t} />
                </div>
              </div>
            )}
          </section>
        </div>

        <section className={styles.answers}>
          {mode === 'play' && !solved ? (
            <ListenPanel
              key={`${question.id}-${wrongNotes.length}`}
              shake={wrongNotes.length > 0}
            />
          ) : (
            <ol className={styles.choices}>
              {question.choices.map((choice, i) => {
                // Playing it: once solved, just show the note it was.
                if (mode === 'play' && i !== question.correctIndex) return null
                const { label, detail } = formatAnswer(t, choice)
                const variant = variantFor(i)
                const dimmed = solved && i !== question.correctIndex
                return (
                  <li
                    key={`${question.id}-${i}`}
                    className={[styles.slot, dimmed && styles.gone]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className={styles.slotInner}>
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
                          {detail && (
                            <span className={styles.choiceDetail}>{detail}</span>
                          )}
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
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

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
                  {feedback.text}
                </span>
              ) : pending !== null ? (
                t('quiz.confirmHint')
              ) : isReturn ? (
                t('quiz.returning')
              ) : null}
            </p>

            {solved ? (
              <Button3D size="lg" className={styles.next} onClick={onNext} autoFocus>
                {isLast ? t('quiz.finish') : t('quiz.next')}
                <IconArrowRight size={24} aria-hidden="true" />
              </Button3D>
            ) : (
              <div className={styles.footerButtons}>
                <Button3D
                  variant="ghost"
                  size="lg"
                  className={styles.dontKnow}
                  onClick={onDontKnow}
                >
                  <IconHelp size={24} aria-hidden="true" />
                  {t('quiz.dontKnow')}
                </Button3D>
                {length === 0 && results.length > 0 && (
                  <Button3D variant="ghost" size="lg" onClick={finish}>
                    <IconFlag size={22} aria-hidden="true" />
                    {t('quiz.end')}
                  </Button3D>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
