import { CacheStorage, SplendidGrandPiano } from 'smplr'
import { create } from 'zustand'
import { midiOf, type Pitch } from '../music/theory'
import { useSettings } from '../settings/store'

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
// Long enough to ring, short enough to tap again.
const NOTE_SECONDS = 1.3

let ctx: AudioContext | null = null
let piano: ReturnType<typeof SplendidGrandPiano> | null = null
let pianoReady: Promise<void> | null = null

function context(): AudioContext {
  ctx ??= new AudioContext({ latencyHint: 'interactive' })
  return ctx
}

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

/**
 * iOS audio session for the next sound:
 * - 'ambient' (default): obeys the silent switch, mixes with other audio and
 *   never shows in the Dynamic Island.
 * - 'playback' ("Play in silent mode"): ignores the silent switch, but iOS treats
 *   Kiano like a music player: Dynamic Island / Now Playing, other audio paused.
 */
function chooseSession(): boolean {
  window.clearTimeout(releaseTimer)
  const playback = useSettings.getState().silentMode
  const type = playback ? 'playback' : 'ambient'
  const session = (navigator as AudioSessionNavigator).audioSession
  if (session && session.type !== type) session.type = type
  return playback
}

// In 'playback', iOS keeps Kiano in the Dynamic Island after a note ends. Once
// things go quiet, suspend the audio and hand the session back so it disappears.
let releaseTimer: number | undefined
const RELEASE_AFTER_MS = 2500

function releaseSoon(soundSeconds: number) {
  window.clearTimeout(releaseTimer)
  releaseTimer = window.setTimeout(
    () => {
      if (!ctx || ctx.state !== 'running') return
      void ctx.suspend().then(() => {
        const session = (navigator as AudioSessionNavigator).audioSession
        if (session) session.type = 'auto'
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = null
          navigator.mediaSession.playbackState = 'none'
        }
      })
    },
    soundSeconds * 1000 + RELEASE_AFTER_MS,
  )
}

/**
 * Pick the session and wake the context (it may be suspended between sounds)
 * before scheduling anything. Returns whether we're in 'playback'.
 */
async function ready(c: AudioContext) {
  const playback = chooseSession()
  if (c.state === 'suspended') await c.resume()
  return playback
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
  const playback = await ready(context())
  await loadPiano()
  if (!piano || !ctx) return
  if (playback) releaseSoon(NOTE_SECONDS + pitches.length * roll)
  const now = ctx.currentTime + 0.01
  pitches.forEach((p, i) => {
    piano!.start({
      note: midiOf(p),
      velocity: VELOCITY,
      time: now + i * roll,
      duration: NOTE_SECONDS,
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

export async function playChime(kind: 'correct' | 'wrong') {
  const c = context()
  if (await ready(c)) releaseSoon(0.6)
  const t = c.currentTime + 0.01
  if (kind === 'correct') {
    // A bright little "bling": E6 then A6.
    tone(c, 1318.5, t, 0.25)
    tone(c, 1760, t + 0.09, 0.4)
  } else {
    // A gentle "uh-oh": B♭4 down to F4. High enough for phone speakers, which
    // barely reproduce anything under ~300 Hz (the old 220 Hz bonk got lost).
    tone(c, 466.2, t, 0.17, { gain: 0.3 })
    tone(c, 349.2, t + 0.13, 0.32, { gain: 0.3, glideTo: 330 })
  }
}
