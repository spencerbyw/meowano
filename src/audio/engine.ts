import { CacheStorage, SplendidGrandPiano } from 'smplr'
import { create } from 'zustand'
import { midiOf, type Pitch } from '../music/theory'

/**
 * All sound lives here. Browsers (iOS especially) only allow audio after a user
 * gesture, so the AudioContext is created lazily from `unlockAudio()`, which
 * should be called inside a tap handler.
 */

type PianoStatus = 'idle' | 'loading' | 'ready' | 'error'

export const useAudioStatus = create<{ piano: PianoStatus }>()(() => ({ piano: 'idle' }))

// One velocity layer over the range Kiano can show (B1–D6, plus accidentals),
// cached in the browser so it works offline after the first load.
const LOW_MIDI = 33
const HIGH_MIDI = 88
const VELOCITY = 76

let ctx: AudioContext | null = null
let piano: ReturnType<typeof SplendidGrandPiano> | null = null
let pianoReady: Promise<void> | null = null

function context(): AudioContext {
  ctx ??= new AudioContext({ latencyHint: 'interactive' })
  return ctx
}

/** Ask iOS to play through the speaker even when the ring/silent switch is on. */
function preferPlayback() {
  const session = (navigator as Navigator & { audioSession?: { type: string } })
    .audioSession
  if (session && session.type !== 'playback') session.type = 'playback'
}

function loadPiano(): Promise<void> {
  if (pianoReady) return pianoReady
  useAudioStatus.setState({ piano: 'loading' })
  piano = SplendidGrandPiano(context(), {
    storage: CacheStorage('kiano-piano'),
    volume: 110,
    notesToLoad: {
      notes: Array.from({ length: HIGH_MIDI - LOW_MIDI + 1 }, (_, i) => LOW_MIDI + i),
      velocityRange: [VELOCITY, VELOCITY],
    },
  })
  pianoReady = piano.load.then(
    () => useAudioStatus.setState({ piano: 'ready' }),
    (err: unknown) => {
      console.warn('Piano failed to load', err)
      useAudioStatus.setState({ piano: 'error' })
      pianoReady = null // allow a retry on the next tap
    },
  )
  return pianoReady
}

/** Call from a tap/click handler: wakes the audio context and starts loading samples. */
export function unlockAudio() {
  const c = context()
  if (c.state === 'suspended') void c.resume()
  void loadPiano()
}

/** Play pitches together, with a tiny roll from the bottom so chords sound natural. */
export async function playNotes(pitches: Pitch[], { roll = 0.025 } = {}) {
  unlockAudio()
  preferPlayback()
  await loadPiano()
  if (!piano || !ctx) return
  const now = ctx.currentTime + 0.01
  pitches.forEach((p, i) => {
    piano!.start({
      note: midiOf(p),
      velocity: VELOCITY,
      time: now + i * roll,
      duration: 1.6,
    })
  })
}

// ---------------------------------------------------------------------------
// Feedback chimes, synthesized so there are no extra files to download.

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  length: number,
  { type = 'triangle' as OscillatorType, gain = 0.18, glideTo = 0 } = {},
) {
  const osc = c.createOscillator()
  const amp = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + length)
  amp.gain.setValueAtTime(0, start)
  amp.gain.linearRampToValueAtTime(gain, start + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(amp).connect(c.destination)
  osc.start(start)
  osc.stop(start + length + 0.05)
}

export function playChime(kind: 'correct' | 'wrong') {
  const c = context()
  if (c.state === 'suspended') void c.resume()
  preferPlayback()
  const t = c.currentTime + 0.01
  if (kind === 'correct') {
    // A bright little "bling": E6 then A6.
    tone(c, 1318.5, t, 0.25)
    tone(c, 1760, t + 0.09, 0.4)
  } else {
    // A soft, low "bonk".
    tone(c, 220, t, 0.22, { type: 'sine', gain: 0.25, glideTo: 140 })
  }
}
