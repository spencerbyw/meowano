import { IconArrowLeft, IconTrash } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { onMicFrame, onNotePlayed, useMic, type MicFrame } from '../audio/mic'
import { MIN_CLARITY, MIN_GATE, midiOfFreq } from '../audio/pitch'
import { ListenPanel } from '../components/ListenPanel'
import { Button3D } from '../components/ui/Button3D'
import { formatPitchClass } from '../music/format'
import { majorKey, spellMidi } from '../music/theory'
import { useQuiz } from '../quiz/store'
import styles from './MicTestScreen.module.css'

/**
 * A mic test for "Play the note" (Settings → Play the note): shows what the pitch
 * detector hears frame by frame, and the notes it actually counts, against a chosen
 * target note. A troubleshooting tool, so English only.
 */

const SHARPS = majorKey(0)
const FLATS = majorKey(-1)
const LOWEST = 36 // C2
const HIGHEST = 84 // C6
const db = (rms: number) => 20 * Math.log10(rms + 1e-9)

interface Counted {
  midi: number
  at: number
}

export function MicTestScreen() {
  const { t } = useTranslation()
  const goHome = useQuiz((s) => s.goHome)
  const status = useMic((s) => s.status)
  const [target, setTarget] = useState(70) // B♭4
  const [frame, setFrame] = useState<MicFrame | null>(null)
  const [counted, setCounted] = useState<Counted[]>([])
  const [peak, setPeak] = useState(-120)
  const latest = useRef<MicFrame | null>(null)
  const peakRef = useRef(-120)

  const name = (midi: number) => {
    const sharp = spellMidi(midi, SHARPS)
    const flat = spellMidi(midi, FLATS)
    const a = `${formatPitchClass(t, sharp)}${sharp.octave}`
    const b = `${formatPitchClass(t, flat)}${flat.octave}`
    return a === b ? a : `${a} / ${b}`
  }

  useEffect(() => {
    const offFrame = onMicFrame((f) => {
      latest.current = f
      peakRef.current = Math.max(peakRef.current, db(f.rms))
    })
    const offNote = onNotePlayed((midi) =>
      setCounted((c) => [{ midi, at: Date.now() }, ...c].slice(0, 12)),
    )
    // Redraw 10× a second; the mic runs faster than that.
    const id = window.setInterval(() => {
      setFrame(latest.current)
      setPeak(peakRef.current)
    }, 100)
    return () => {
      offFrame()
      offNote()
      window.clearInterval(id)
    }
  }, [])

  const reading = frame?.reading ?? null
  const clarity = reading?.clarity ?? 0
  const exact = reading ? midiOfFreq(reading.freq) : null
  const heard = exact === null ? null : Math.round(exact)
  const cents = exact === null || heard === null ? 0 : Math.round((exact - heard) * 100)
  const level = frame ? db(frame.rms) : -120
  const gate = db(frame ? frame.gate : MIN_GATE)

  const verdict = !frame
    ? 'Waiting for the mic…'
    : frame.muted
      ? 'Muted: Kiano is making a sound'
      : level < gate
        ? 'Too quiet (below the gate)'
        : !reading
          ? 'Loud enough, but no clear pitch'
          : clarity < MIN_CLARITY
            ? `Not clear enough (needs ${MIN_CLARITY.toFixed(2)})`
            : `Clear: ${name(heard!)}`

  const pct = (dB: number) => `${Math.min(100, Math.max(0, ((dB + 80) / 80) * 100))}%`

  return (
    <div className={`screen-frame ${styles.screen}`}>
      <header className={styles.top}>
        <Button3D variant="ghost" size="sm" onClick={goHome} aria-label="Back">
          <IconArrowLeft size={22} aria-hidden="true" />
        </Button3D>
        <h1 className={styles.title}>Mic test</h1>
        <span />
      </header>

      <div className="scroll-area">
        <main className={styles.main}>
          {status !== 'on' && <ListenPanel />}

          <section className={styles.card}>
            <h2 className={styles.label}>Hearing right now</h2>
            <p className={styles.note}>{heard === null ? '—' : name(heard)}</p>
            <p className={`${styles.sub} ${styles.oneLine}`}>
              {reading
                ? `${reading.freq.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents}¢ off`
                : '\u00a0'}
            </p>
            <p className={styles.verdict}>{verdict}</p>

            <div className={styles.meter}>
              <span className={styles.meterLabel}>
                Level {level.toFixed(0)} dB (peak {peak.toFixed(0)})
              </span>
              <span className={styles.bar}>
                <span className={styles.fill} style={{ width: pct(level) }} />
                <span className={styles.mark} style={{ left: pct(gate) }} />
              </span>
              <span className={styles.meterHint}>
                Line: noise gate {gate.toFixed(0)} dB
              </span>
            </div>

            <div className={styles.meter}>
              <span className={styles.meterLabel}>Clarity {clarity.toFixed(2)}</span>
              <span className={styles.bar}>
                <span className={styles.fill} style={{ width: `${clarity * 100}%` }} />
                <span className={styles.mark} style={{ left: `${MIN_CLARITY * 100}%` }} />
              </span>
              <span className={styles.meterHint}>Line: needed to count</span>
            </div>
          </section>

          <section className={styles.card}>
            <label className={styles.label} htmlFor="mic-target">
              Note to check
            </label>
            <select
              id="mic-target"
              className={styles.select}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            >
              {Array.from({ length: HIGHEST - LOWEST + 1 }, (_, i) => HIGHEST - i).map(
                (m) => (
                  <option key={m} value={m}>
                    {name(m)} {m === 60 ? '(middle C)' : ''}
                  </option>
                ),
              )}
            </select>
            <p className={`${styles.sub} ${styles.oneLine}`}>
              {(440 * 2 ** ((target - 69) / 12)).toFixed(1)} Hz
              {heard !== null && !frame?.muted && level >= gate
                ? heard === target
                  ? ' · hearing it now ✓'
                  : ` · hearing ${heard > target ? '+' : ''}${heard - target} semitones away`
                : ''}
            </p>

            <div className={styles.logHead}>
              <h2 className={styles.label}>Notes it counted</h2>
              {counted.length > 0 && (
                <Button3D variant="ghost" size="sm" onClick={() => setCounted([])}>
                  <IconTrash size={18} aria-hidden="true" />
                  Clear
                </Button3D>
              )}
            </div>
            {counted.length === 0 ? (
              <p className={styles.sub}>
                Play a note: each key press should appear once.
              </p>
            ) : (
              <ol className={styles.log}>
                {counted.map((c) => (
                  <li
                    key={c.at + '-' + c.midi}
                    className={c.midi === target ? styles.hit : ''}
                  >
                    <span>{name(c.midi)}</span>
                    <span>
                      {c.midi === target
                        ? '✓ match'
                        : `${c.midi > target ? 'too high' : 'too low'} (${c.midi > target ? '+' : ''}${c.midi - target})`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
