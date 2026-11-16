import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconChevronDown,
  IconBolt,
  IconCat,
  IconClick,
  IconHandFinger,
  IconMinus,
  IconPaw,
  IconPawFilled,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconPlus,
  IconSparkle,
  IconVolume,
  IconWaveSquare,
  IconWood,
  type Icon,
} from '@tabler/icons-react'
import { Collapsible, Slider, ToggleGroup } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CLICK_SOUNDS,
  onBeat,
  previewClick,
  setMetronome,
  startMetronome,
  stopMetronome,
  type Beat,
  type ClickSound,
} from '../audio/metronome'
import { PeekCat, type DrumHit, type DrumPattern } from '../components/PeekCat'
import { Button3D } from '../components/ui/Button3D'
import { useQuiz } from '../quiz/store'
import { useSettings } from '../settings/store'
import { MAX_BPM, MIN_BPM, clampBpm, useToybox } from '../toybox/store'
import { useMediaQuery } from '../ui/useMediaQuery'
import styles from './MetronomeScreen.module.css'

/** Tempo words, from the slowest (the number is where each one starts). */
const TEMPOS = [
  [0, 'largo'],
  [60, 'adagio'],
  [76, 'andante'],
  [108, 'moderato'],
  [120, 'allegro'],
  [168, 'presto'],
] as const
const tempoOf = (bpm: number) => TEMPOS.findLast(([from]) => bpm >= from)![1]

const PATTERNS: DrumPattern[] = ['alternate', 'both', 'clap', 'sway']
/** The cat switches how it keeps time after this many bars. */
const BARS_PER_PATTERN = 8
/** Taps further apart than this start a new tap tempo. */
const TAP_RESET_MS = 2000
const SOUND_ICONS: Record<ClickSound, Icon> = {
  pop: IconBolt,
  tap: IconHandFinger,
  click: IconClick,
  wood: IconWood,
  beep: IconWaveSquare,
  tick: IconSparkle,
  mew: IconCat,
}

const BEAT_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8]

const otherPattern = (current?: DrumPattern) => {
  const choices = PATTERNS.filter((p) => p !== current)
  return choices[Math.floor(Math.random() * choices.length)]
}

export function MetronomeScreen() {
  const { t } = useTranslation()
  const goHome = useQuiz((s) => s.goHome)
  const catMode = useSettings((s) => s.catMode)
  const { bpm, beats, sound, setBpm, setBeats, setSound } = useToybox()
  const [running, setRunning] = useState(false)
  // Beats and sound fold away under Start, so the cat gets the room; side by side
  // (wide screens) there's space to show them all the time.
  const [moreOpen, setMoreOpen] = useState(false)
  const wide = useMediaQuery(
    '(orientation: landscape) and (min-width: 700px) and (min-height: 501px)',
  )
  const [hit, setHit] = useState<(Beat & { pattern: DrumPattern; next: DrumPattern }) | null>(
    null,
  )
  const pattern = useRef<DrumPattern>('alternate')
  /** The pattern for the next beat: picked a beat early, so the paws get there in time. */
  const upcoming = useRef<DrumPattern>('alternate')
  const taps = useRef<number[]>([])
  const holdToRepeat = useHoldToRepeat()

  useEffect(() => setMetronome({ bpm, beats, sound }), [bpm, beats, sound])

  // Each beat as it's heard: drum it, and now and then change how.
  useEffect(
    () =>
      onBeat((beat) => {
        const period = beats * BARS_PER_PATTERN
        if (beat.count > 0 && beat.count % period === 0) pattern.current = upcoming.current
        upcoming.current =
          (beat.count + 1) % period === 0 ? otherPattern(pattern.current) : pattern.current
        setHit({ ...beat, pattern: pattern.current, next: upcoming.current })
      }),
    [beats],
  )

  // Stop on leaving the screen, or when the app goes into the background.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) {
        stopMetronome()
        setRunning(false)
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      stopMetronome()
    }
  }, [])

  useWakeLock(running)

  const toggle = () => {
    if (running) {
      stopMetronome()
      setRunning(false)
      setHit(null)
      return
    }
    pattern.current = otherPattern()
    upcoming.current = pattern.current
    setRunning(true)
    void startMetronome()
  }

  // Space starts and stops it (keyboards).
  const toggleRef = useRef(toggle)
  useEffect(() => {
    toggleRef.current = toggle
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const el = document.activeElement
      if (el && el !== document.body && el.tagName !== 'MAIN') return
      e.preventDefault()
      toggleRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Tap tempo: the average gap between the last few taps.
  const tap = () => {
    const now = performance.now()
    const list = taps.current
    if (list.length && now - list[list.length - 1] > TAP_RESET_MS) list.length = 0
    list.push(now)
    if (list.length > 5) list.shift()
    if (list.length >= 2) {
      const gap = (list[list.length - 1] - list[0]) / (list.length - 1)
      setBpm(60_000 / gap)
    }
  }

  const tempo = tempoOf(bpm)
  const drum: DrumHit | undefined =
    running && hit
      ? {
          count: hit.count,
          pattern: hit.pattern,
          next: hit.next,
          accent: hit.accent,
          seconds: hit.seconds,
        }
      : undefined
  const mood = !running ? 'idle' : bpm >= 200 ? 'curious' : 'listening'

  return (
    <div className="screen-frame">
      <header className={styles.top}>
        <Button3D variant="ghost" size="sm" onClick={goHome} aria-label={t('toybox.back')}>
          <IconArrowLeft size={22} aria-hidden="true" />
        </Button3D>
        <h1 className={styles.title}>{t('metronome.title')}</h1>
      </header>

      <div className="scroll-area">
        <main className={styles.main}>
          <section className={styles.card}>
            <PeekCat
              className={styles.cat}
              mood={mood}
              sleepy={!running}
              drum={drum}
              onPet={tap}
              petLabel={t('metronome.tapCat')}
            />
            <div className={styles.tempoRow}>
              <Button3D
                variant="primary"
                size="sm"
                className={styles.step}
                aria-label={t('metronome.slower')}
                {...holdToRepeat(() => nudgeBpm(-1))}
              >
                <IconMinus size={24} stroke={2.75} aria-hidden="true" />
              </Button3D>
              <p className={styles.bpm} aria-live="polite">
                <span className={styles.bpmNumber}>{bpm}</span>
                <span className={styles.bpmUnit}>{t('metronome.bpm')}</span>
              </p>
              <Button3D
                variant="primary"
                size="sm"
                className={styles.step}
                aria-label={t('metronome.faster')}
                {...holdToRepeat(() => nudgeBpm(+1))}
              >
                <IconPlus size={24} stroke={2.75} aria-hidden="true" />
              </Button3D>
            </div>
            <p className={styles.tempoName}>
              {catMode ? (
                <>
                  <span className={styles.tempoCat}>{t(`metronome.tempoCat.${tempo}`)}</span>
                  <span className={styles.tempoItalian}>{t(`metronome.tempoNames.${tempo}`)}</span>
                </>
              ) : (
                <span className={styles.tempoCat}>{t(`metronome.tempoNames.${tempo}`)}</span>
              )}
            </p>
            <ol className={styles.beatPaws} aria-hidden="true">
              {Array.from({ length: beats }, (_, i) => (
                <li
                  key={i}
                  className={[
                    styles.beatPaw,
                    i === 0 && beats > 1 && styles.first,
                    running && hit?.inBar === i && styles.now,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <IconPawFilled size={i === 0 && beats > 1 ? 26 : 22} />
                </li>
              ))}
            </ol>
          </section>

          <div className={styles.sliderRow}>
            <Slider.Root
              className={styles.slider}
              value={[bpm]}
              min={MIN_BPM}
              max={MAX_BPM}
              step={1}
              onValueChange={([v]) => setBpm(clampBpm(v))}
              aria-label={t('metronome.tempo')}
            >
              <Slider.Track className={styles.track}>
                <Slider.Range className={styles.range} />
              </Slider.Track>
              <Slider.Thumb
                className={styles.thumb}
                aria-label={t('metronome.tempo')}
                aria-valuetext={t('metronome.tempoValue', { bpm })}
              />
            </Slider.Root>
            <Button3D
              variant="ghost"
              size="sm"
              className={styles.tap}
              aria-label={t('metronome.tapLabel')}
              onClick={tap}
            >
              {t('metronome.tap')}
            </Button3D>
          </div>

          <Button3D
            variant={running ? 'secondary' : 'primary'}
            size="lg"
            className={styles.startButton}
            onClick={toggle}
          >
            {running ? (
              <IconPlayerStopFilled size={24} aria-hidden="true" />
            ) : (
              <IconPlayerPlayFilled size={24} aria-hidden="true" />
            )}
            {running ? t('metronome.stop') : t('metronome.start')}
          </Button3D>

          <Collapsible.Root
            open={wide || moreOpen}
            onOpenChange={setMoreOpen}
            className={styles.more}
          >
            <Collapsible.Trigger className={styles.moreButton}>
              <IconAdjustmentsHorizontal size={20} aria-hidden="true" />
              <span className={styles.moreText}>
                {t('metronome.beatsSummary', { count: beats })} ·{' '}
                {t(`metronome.sounds.${sound}`)}
              </span>
              <IconChevronDown size={20} aria-hidden="true" className={styles.chevron} />
            </Collapsible.Trigger>
            <Collapsible.Content
              className={styles.moreContent}
              onAnimationEnd={(e) => {
                // Once it has opened (not a chip's animation), bring it into view.
                if (e.target === e.currentTarget && e.currentTarget.dataset.state === 'open') {
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                }
              }}
            >
              <section className={styles.panel}>
                <h2 id="beats-label" className={styles.label}>
                  <IconPaw size={22} aria-hidden="true" />
                  {t('metronome.beats')}
                </h2>
                <ToggleGroup.Root
                  type="single"
                  aria-labelledby="beats-label"
                  className={styles.chips}
                  value={String(beats)}
                  onValueChange={(v) => v && setBeats(Number(v))}
                >
                  {BEAT_CHOICES.map((n) => (
                    <ToggleGroup.Item key={n} value={String(n)} className={`${styles.chip} squircle`}>
                      {n}
                    </ToggleGroup.Item>
                  ))}
                </ToggleGroup.Root>

                <h2 id="sound-label" className={styles.label}>
                  <IconVolume size={22} aria-hidden="true" />
                  {t('metronome.sound')}
                </h2>
                <ToggleGroup.Root
                  type="single"
                  aria-labelledby="sound-label"
                  className={styles.sounds}
                  value={sound}
                  onValueChange={(v) => {
                    if (!v) return
                    setSound(v as ClickSound)
                    void previewClick(v as ClickSound)
                  }}
                >
                  {CLICK_SOUNDS.map((s) => {
                    const SoundIcon = SOUND_ICONS[s]
                    return (
                      <ToggleGroup.Item key={s} value={s} className={styles.sound}>
                        <SoundIcon size={18} aria-hidden="true" />
                        {t(`metronome.sounds.${s}`)}
                      </ToggleGroup.Item>
                    )
                  })}
                </ToggleGroup.Root>
              </section>
            </Collapsible.Content>
          </Collapsible.Root>
        </main>
      </div>
    </div>
  )
}

/** One step slower or faster, from the tempo as it is right now. */
function nudgeBpm(by: number) {
  const { bpm, setBpm } = useToybox.getState()
  setBpm(bpm + by)
}

/** Hold before repeating, then the gap between steps: quicker the longer it's held. */
const HOLD_MS = 400
const REPEAT_MS = 110
const FASTEST_MS = 35

/**
 * Press for one step; hold to keep stepping, faster and faster. Keyboards get a
 * step per press (and their own key repeat).
 */
function useHoldToRepeat() {
  // Kept across renders (each step re-renders), so letting go always stops it.
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (step: () => void) => holdHandlers(step, timer)
}

function holdHandlers(step: () => void, timer: { current: number | undefined }) {
  const stop = () => window.clearTimeout(timer.current)
  const go = (gap: number) => {
    step()
    timer.current = window.setTimeout(() => go(Math.max(FASTEST_MS, gap * 0.9)), gap)
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      stop()
      step()
      timer.current = window.setTimeout(() => go(REPEAT_MS), HOLD_MS)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // A click from the keyboard (a pointer press has already stepped).
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 0) step()
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}

/** Keep the screen on while it's ticking (where the browser allows it). */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const take = () => {
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) void l.release()
          else lock = l
        })
        .catch(() => {})
    }
    const onShow = () => {
      if (!document.hidden) take()
    }
    take()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onShow)
      void lock?.release()
    }
  }, [on])
}
