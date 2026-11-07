import { IconArrowLeft, IconFlame, IconTrash } from '@tabler/icons-react'
import { AlertDialog } from 'radix-ui'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CatMark } from '../components/Logo'
import { Staff } from '../components/Staff'
import { Button3D } from '../components/ui/Button3D'
import { formatPitchClass } from '../music/format'
import type { Clef } from '../music/ranges'
import { intervalName, parsePitch, stepOf, type Pitch } from '../music/theory'
import { useQuiz } from '../quiz/store'
import { missScore, useStats, type ItemStats } from '../stats/store'
import styles from './StatsScreen.module.css'

interface ParsedItem extends ItemStats {
  key: string
  clef: Clef
  kind: string
  notes: Pitch[]
}

const parse = (key: string, stats: ItemStats): ParsedItem => {
  const [clef, kind, notes] = key.split(':')
  return {
    ...stats,
    key,
    clef: clef as Clef,
    kind,
    notes: notes.split('-').map(parsePitch),
  }
}

const pct = (right: number, total: number) =>
  total ? Math.round((right / total) * 100) : 0

const tier = (accuracy: number) =>
  accuracy >= 90 ? styles.good : accuracy >= 70 ? styles.okay : styles.tough

export function StatsScreen() {
  const { t } = useTranslation()
  const goHome = useQuiz((s) => s.goHome)
  const stats = useStats()

  const items = useMemo(
    () => Object.entries(stats.items).map(([k, v]) => parse(k, v)),
    [stats.items],
  )

  const tricky = useMemo(
    () =>
      items
        .filter((i) => i.missed > 0)
        .sort((a, b) => missScore(b) - missScore(a) || b.seen - a.seen)
        .slice(0, 6),
    [items],
  )

  const noteGrid = useMemo(() => {
    const byClef: Record<Clef, ParsedItem[]> = { treble: [], bass: [] }
    items.filter((i) => i.kind === 'note').forEach((i) => byClef[i.clef].push(i))
    for (const list of Object.values(byClef)) {
      list.sort(
        (a, b) => stepOf(a.notes[0]) - stepOf(b.notes[0]) || a.key.localeCompare(b.key),
      )
    }
    return byClef
  }, [items])

  const describe = (i: ParsedItem) => {
    const names = i.notes.map((n) => formatPitchClass(t, n)).join('–')
    if (i.kind === 'dyad') {
      const name = intervalName(i.notes[0], i.notes[1])
      return name ? `${t(`intervals.${name}` as 'intervals.M3')} (${names})` : names
    }
    return names
  }

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <Button3D variant="ghost" size="sm" onClick={goHome} aria-label={t('stats.back')}>
          <IconArrowLeft size={22} aria-hidden="true" />
        </Button3D>
        <h1 className={styles.title}>{t('stats.title')}</h1>
        <span />
      </header>

      <main className={styles.main}>
        {stats.answered === 0 ? (
          <div className={styles.empty}>
            <CatMark size={88} />
            <p>{t('stats.empty')}</p>
          </div>
        ) : (
          <>
            <section className={styles.overview}>
              <Tile value={stats.answered} label={t('stats.answered')} />
              <Tile
                value={`${pct(stats.firstTry, stats.answered)}%`}
                label={t('stats.accuracy')}
              />
              <Tile
                value={
                  <>
                    <IconFlame size={28} aria-hidden="true" className={styles.flame} />
                    {stats.bestStreak}
                  </>
                }
                label={t('stats.bestStreak')}
              />
              <Tile
                value={stats.daysPracticed}
                label={t('stats.days')}
                sub={
                  stats.dayStreak > 1
                    ? t('stats.dayStreak', { count: stats.dayStreak })
                    : undefined
                }
              />
            </section>

            <section className={styles.section}>
              <h2 className={styles.heading}>{t('stats.tricky')}</h2>
              {tricky.length === 0 ? (
                <p className={styles.muted}>{t('stats.trickyEmpty')}</p>
              ) : (
                <ul className={styles.tricky}>
                  {tricky.map((i) => (
                    <li key={i.key} className={styles.trickyItem}>
                      <Staff
                        className={styles.trickyStaff}
                        clef={i.clef}
                        notes={i.notes}
                        label={describe(i)}
                      />
                      <span className={styles.trickyName}>{describe(i)}</span>
                      <span className={styles.muted}>
                        {t('stats.missed', { missed: i.missed, seen: i.seen })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(noteGrid.treble.length > 0 || noteGrid.bass.length > 0) && (
              <section className={styles.section}>
                <h2 className={styles.heading}>{t('stats.notes')}</h2>
                <p className={styles.muted}>{t('stats.notesHint')}</p>
                {(['treble', 'bass'] as const).map(
                  (clef) =>
                    noteGrid[clef].length > 0 && (
                      <div key={clef} className={styles.clefGroup}>
                        <h3 className={styles.clefName}>{t(`clefs.${clef}`)}</h3>
                        <ul className={styles.grid}>
                          {noteGrid[clef].map((i) => {
                            const accuracy = pct(i.seen - i.missed, i.seen)
                            return (
                              <li
                                key={i.key}
                                className={`${styles.cell} ${tier(accuracy)}`}
                              >
                                <span className={styles.cellNote}>
                                  {formatPitchClass(t, i.notes[0])}
                                  <sub>{i.notes[0].octave}</sub>
                                </span>
                                <span className={styles.cellPct}>{accuracy}%</span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ),
                )}
              </section>
            )}

            <AlertDialog.Root>
              <AlertDialog.Trigger asChild>
                <Button3D variant="ghost" size="sm" className={styles.reset}>
                  <IconTrash size={18} aria-hidden="true" />
                  {t('stats.reset')}
                </Button3D>
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className={styles.overlay} />
                <AlertDialog.Content className={styles.dialog}>
                  <AlertDialog.Title className={styles.dialogTitle}>
                    {t('stats.resetTitle')}
                  </AlertDialog.Title>
                  <AlertDialog.Description className={styles.muted}>
                    {t('stats.resetBody')}
                  </AlertDialog.Description>
                  <div className={styles.dialogActions}>
                    <AlertDialog.Cancel asChild>
                      <Button3D variant="ghost">{t('stats.cancel')}</Button3D>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action asChild>
                      <Button3D variant="error" onClick={stats.reset}>
                        {t('stats.resetConfirm')}
                      </Button3D>
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </>
        )}
      </main>
    </div>
  )
}

function Tile({
  value,
  label,
  sub,
}: {
  value: React.ReactNode
  label: string
  sub?: string
}) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
      {sub && <span className={styles.tileSub}>{sub}</span>}
    </div>
  )
}
