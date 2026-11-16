import { CacheStorage, SplendidGrandPiano, type StopFn } from 'smplr'
import { create } from 'zustand'
import { midiOf, type Pitch } from '../music/theory'
import { useSettings } from '../settings/store'
import { micActive, muteMic } from './mic'

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
  // "Play the note" has the mic on: iOS must stay in record mode or the mic stops.
  if (micActive()) return false
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

/*
 * The piano's sound goes through a "room" that the keyboard turns on. A real piano
 * keeps ringing while a key is held: after the bright strike, a long, quieter
 * hum. The samples have that hum, but it's so much quieter than the strike that a
 * phone speaker loses it within a second. In the room, the hum is brought up
 * (gently compressed, as your ear hears a piano across a room) and given a little
 * of the room's own ring. The quiz's piano plays dry, as before.
 */
interface Room {
  input: GainNode
  dry: GainNode
  wet: GainNode
}

let room: Room | null = null
const ROOM_FADE_S = 0.08
/** Loudness of the brought-up sound, so a strike is about as loud as without. */
const ROOM_LEVEL = 2.6
const ROOM_ECHO = 0.14

function pianoRoom(c: AudioContext): Room {
  if (room) return room
  const input = c.createGain()
  const dry = c.createGain()
  input.connect(dry).connect(c.destination)

  // The long hum, brought up toward the strike.
  const squeeze = c.createDynamicsCompressor()
  squeeze.threshold.value = -46
  squeeze.knee.value = 12
  squeeze.ratio.value = 5
  squeeze.attack.value = 0.004
  squeeze.release.value = 0.5
  const wet = c.createGain()
  wet.gain.value = 0
  input.connect(squeeze).connect(wet).connect(c.destination)

  // And a little room around it.
  const echo = c.createConvolver()
  echo.buffer = roomEcho(c)
  const send = c.createGain()
  send.gain.value = ROOM_ECHO
  wet.connect(send).connect(echo).connect(c.destination)

  room = { input, dry, wet }
  return room
}

/** A soft room's echo: warm noise, dying away over a couple of seconds. */
function roomEcho(c: AudioContext) {
  const seconds = 2.2
  const n = Math.floor(seconds * c.sampleRate)
  const buffer = c.createBuffer(2, n, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    let warm = 0
    for (let i = 0; i < n; i++) {
      // Smoothed (duller highs, like soft furnishings), then faded out.
      warm += 0.35 * (Math.random() * 2 - 1 - warm)
      data[i] = warm * Math.exp((-6.9 * i) / n)
    }
  }
  return buffer
}

/** The keyboard turns the room on while it's open. */
export function setPianoRoom(on: boolean) {
  const r = pianoRoom(context())
  const t = context().currentTime
  r.dry.gain.setTargetAtTime(on ? 0 : 1, t, ROOM_FADE_S)
  r.wet.gain.setTargetAtTime(on ? ROOM_LEVEL : 0, t, ROOM_FADE_S)
}

function loadPiano(): Promise<void> {
  if (pianoReady) return pianoReady
  useAudioStatus.setState({ piano: 'loading' })
  piano = SplendidGrandPiano(context(), {
    destination: pianoRoom(context()).input,
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

/**
 * For tools that make their own sounds (the metronome): the audio context, awake
 * and with the right iOS session. Call from a tap handler.
 */
export async function wakeAudio(): Promise<AudioContext> {
  const c = context()
  await ready(c)
  return c
}

/** When a tool's sounds stop: lets 'playback' go once the last one has rung out. */
export function releaseAudio(afterSeconds = 0) {
  if (useSettings.getState().silentMode) releaseSoon(afterSeconds)
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
  // Don't let the mic take Kiano's own piano for the player's (it rings a while).
  muteMic((NOTE_SECONDS + pitches.length * roll) * 1000 + 1500)
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

/** The notes there are piano samples for (A1 to E6): the keyboard's range. */
export const PIANO_RANGE = { low: LOW_MIDI, high: HIGH_MIDI }

/** Lifting a key: lets go of the note (it fades as a real piano's would). */
const HELD_RELEASE_S = 1.2

/** Letting go of a key: the damper comes down this fast. */
const DAMPER_S = 0.45

/**
 * How long each recorded note lasts (seconds), by the note it was recorded at.
 * A held key fades out just before its recording runs out, instead of stopping
 * dead (the room makes the very end of the ring loud enough to hear).
 */
const RECORDED_S: Record<number, number> = {
  33: 12.17,
  35: 12.02,
  37: 11.1,
  38: 13.08,
  40: 12.36,
  41: 12.06,
  43: 9.66,
  45: 11.99,
  47: 9.22,
  48: 9.13,
  50: 7,
  52: 9.3,
  53: 10.54,
  55: 9.55,
  56: 9.65,
  57: 10.31,
  58: 10.21,
  59: 10.75,
  60: 8.03,
  62: 7.46,
  64: 7.56,
  65: 6.77,
  67: 5.98,
  69: 6.35,
  71: 4.49,
  72: 3.91,
  74: 5.72,
  76: 5.96,
  77: 5.85,
  79: 4.82,
  80: 5.38,
  81: 4.29,
  82: 4.03,
  83: 4.96,
  85: 3.49,
  86: 3.19,
  87: 2.1,
  88: 3.29,
}

/**
 * How long a key can ring: notes between recordings play the nearest one, sped
 * up or slowed down (shorter when higher). Takes the shortest of the near ones.
 */
function ringSeconds(midi: number) {
  let seconds = Infinity
  for (const [at, length] of Object.entries(RECORDED_S)) {
    const shift = midi - Number(at)
    if (Math.abs(shift) <= 2) seconds = Math.min(seconds, length / 2 ** (shift / 12))
  }
  return Number.isFinite(seconds) ? seconds : 3
}

/**
 * Press a piano key down: the note sounds until the returned function is called
 * (the key lifted), or it has rung out. Plays at once when the piano is ready; if
 * it's still loading, it sounds when it can, unless the key's already been let go.
 */
let held = 0

export function holdNote(midi: number): () => void {
  let stop: StopFn | undefined
  let lifted = false
  let ringOut: number | undefined
  held++
  const press = () => {
    if (!piano || !ctx || lifted) return
    stop = piano.start({ note: midi, velocity: VELOCITY, ampRelease: DAMPER_S })
    ringOut = window.setTimeout(
      () => stop?.(),
      Math.max(0.5, ringSeconds(midi) - DAMPER_S - 0.15) * 1000,
    )
  }
  if (piano && ctx?.state === 'running' && useAudioStatus.getState().piano === 'ready') {
    // Ready: no waiting, not even a tick.
    chooseSession()
    press()
  } else {
    unlockAudio()
    void ready(context()).then(loadPiano).then(press)
  }
  return () => {
    if (lifted) return
    lifted = true
    window.clearTimeout(ringOut)
    stop?.()
    // Hand the audio back only once every key is up.
    if (--held === 0) releaseAudio(HELD_RELEASE_S)
  }
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
  muteMic(900)
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
