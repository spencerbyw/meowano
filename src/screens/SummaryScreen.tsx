import {
  IconHome,
  IconRefresh,
  IconStarFilled,
  IconTrophyFilled,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { unlockAudio } from '../audio/engine'
import { Confetti } from '../components/Confetti'
import { CatMark } from '../components/Logo'
import { Staff } from '../components/Staff'
import { Button3D } from '../components/ui/Button3D'
import { formatAnswer, formatStaffLabel } from '../music/format'
import { useQuiz } from '../quiz/store'
import { useSettings } from '../settings/store'
import styles from './SummaryScreen.module.css'

export function SummaryScreen() {
  const { t } = useTranslation()
  const { results, bestStreak, recordAtStart, start, goHome } = useQuiz()
  const newRecord = bestStreak > recordAtStart && bestStreak > 1
  const catMode = useSettings((s) => s.catMode)

  const correct = results.filter((r) => r.firstTry).length
  const missed = results.filter((r) => !r.firstTry)
  const perfect = results.length > 0 && missed.length === 0

  return (
    <div className="screen-frame">
      {(perfect || newRecord) && <Confetti />}
      <div className="scroll-area">
        <main className={styles.main}>
          <div className={styles.hero}>
            {catMode ? (
              <CatMark size={88} mood={correct > 0 ? 'happy' : 'idle'} />
            ) : (
              <IconStarFilled size={80} className={styles.star} aria-hidden="true" />
            )}
            <h1 className={styles.title}>
              {t(catMode ? 'summary.titleCat' : 'summary.title')}
            </h1>
          </div>

          <section className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.big}>
                {correct}
                <span className={styles.of}>/{results.length}</span>
              </span>
              <span className={styles.statLabel}>
                {t('summary.score', { correct, total: results.length })}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.big}>{bestStreak}</span>
              <span className={styles.statLabel}>{t('summary.bestStreak')}</span>
              {newRecord && (
                <span className={styles.record}>
                  <IconTrophyFilled size={16} aria-hidden="true" />
                  {t('summary.newRecord')}
                </span>
              )}
            </div>
          </section>

          {perfect ? (
            <p className={styles.perfect}>{t('summary.perfect')}</p>
          ) : (
            missed.length > 0 && (
              <section className={styles.tricky}>
                <h2 className={styles.trickyTitle}>{t('summary.tricky')}</h2>
                <ul className={styles.missList}>
                  {missed.map(({ question }) => {
                    const { label, detail } = formatAnswer(
                      t,
                      question.choices[question.correctIndex],
                    )
                    return (
                      <li key={question.id} className={styles.miss}>
                        <Staff
                          className={styles.missStaff}
                          clef={question.clef}
                          keySignature={question.key}
                          notes={question.notes}
                          label={formatStaffLabel(t, question)}
                        />
                        <span className={styles.missLabel}>{label}</span>
                        {detail && <span className={styles.missDetail}>{detail}</span>}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          )}
        </main>
      </div>
      <div className={styles.actions}>
        <Button3D
          size="lg"
          onClick={() => {
            if (useSettings.getState().sound) unlockAudio()
            start()
          }}
          autoFocus
        >
          <IconRefresh size={24} aria-hidden="true" />
          {t('summary.again')}
        </Button3D>
        <Button3D variant="ghost" onClick={goHome}>
          <IconHome size={22} aria-hidden="true" />
          {t('summary.home')}
        </Button3D>
      </div>
    </div>
  )
}
