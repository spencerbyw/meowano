import { create } from 'zustand'
import { detectPitch, MIN_GATE, NoteTracker, rmsOf, type PitchReading } from './pitch'

/**
 * The microphone for "Play the note". Start it from a tap (iOS needs a user
 * gesture to start audio), then listen with `onNotePlayed`.
 *
 * iOS can leave the mic "on" (orange dot showing) while no sound reaches us, e.g.
 * after the app was in the background: the stream stays live but the audio
 * context processing it is suspended or interrupted, so we'd hear silence forever.
 * So the mic is released when the app is hidden and restarted when it's back, and
 * a watchdog notices a stalled stream and asks for a tap to restart it.
 */

export type MicStatus =
  | 'off'
  | 'starting'
  | 'on'
  | 'denied'
  | 'unsupported'
  | 'error'
  /** The stream went quiet in a way a real mic never does: needs a restart. */
  | 'stalled'

export const useMic = create<{ status: MicStatus }>()(() => ({ status: 'off' }))

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

/** Analyse about 25 times a second; plenty for a person playing notes. */
const FRAME_MS = 40

let stream: MediaStream | null = null
let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let raf = 0
let lastFrame = 0
let mutedUntil = 0
let level = 0
let buffer: Float32Array<ArrayBuffer> | null = null
/** Watchdog: when the context stopped running / the input went dead silent. */
let notRunningSince = 0
let deadSince = 0
let mutedTrackSince = 0
/** The mic was on when the app was hidden, so bring it back when it's shown. */
let resumeOnShow = false

/** How long a stall may last before we give up and ask for a tap. */
const STALL_MS = 1500
/** Exact digital silence this long means no sound is reaching us at all. */
const DEAD_MS = 2000

/** One analysis step, for the mic test screen. */
export interface MicFrame {
  rms: number
  /** Below this RMS counts as silence. */
  gate: number
  reading: PitchReading | null
  muted: boolean
}

const frameListeners = new Set<(frame: MicFrame) => void>()
const noteListeners = new Set<(midi: number) => void>()
const levelListeners = new Set<(level: number) => void>()
const tracker = new NoteTracker((midi) => noteListeners.forEach((fn) => fn(midi)))

/** Whether the mic is in use (the audio engine keeps iOS in record mode meanwhile). */
export const micActive = () => stream !== null

/** Ignore what the mic hears for a while, e.g. while Kiano plays a note itself. */
export function muteMic(ms: number) {
  mutedUntil = Math.max(mutedUntil, performance.now() + ms)
}

export function onNotePlayed(fn: (midi: number) => void) {
  noteListeners.add(fn)
  return () => void noteListeners.delete(fn)
}

/** Every analysis step (about 25 a second): what the mic test screen shows. */
export function onMicFrame(fn: (frame: MicFrame) => void) {
  frameListeners.add(fn)
  return () => void frameListeners.delete(fn)
}

/** Loudness 0–1, for a "can you hear me" meter. */
export function onMicLevel(fn: (level: number) => void) {
  levelListeners.add(fn)
  return () => void levelListeners.delete(fn)
}

function setSession(type: string) {
  const session = (navigator as AudioSessionNavigator).audioSession
  if (session && session.type !== type) session.type = type
}

/** Turn the mic on, or restart it (a fresh stream and audio context). */
export async function startMic() {
  if (useMic.getState().status === 'starting') return
  if (stream) stopMic()
  if (!navigator.mediaDevices?.getUserMedia) {
    useMic.setState({ status: 'unsupported' })
    return
  }
  useMic.setState({ status: 'starting' })
  // iOS: record and play at once (otherwise starting the mic silences Kiano).
  setSession('play-and-record')
  // A context made in the tap handler is allowed to run; make it before awaiting.
  // Always a fresh one: an old context may be stuck "interrupted" by iOS.
  ctx = new AudioContext()
  const resumed = ctx.state !== 'running' ? ctx.resume() : Promise.resolve()
  let media: MediaStream
  try {
    media = await navigator.mediaDevices.getUserMedia({
      // Raw sound: these "voice call" filters smear or mute sustained notes.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    await resumed
  } catch (err) {
    setSession('auto')
    const denied = err instanceof DOMException && err.name === 'NotAllowedError'
    useMic.setState({ status: denied ? 'denied' : 'error' })
    return
  }
  // Stopped (left the quiz) while we were waiting for permission.
  if (useMic.getState().status !== 'starting' || !ctx) {
    media.getTracks().forEach((t) => t.stop())
    return
  }
  stream = media
  const source = ctx.createMediaStreamSource(media)
  analyser = ctx.createAnalyser()
  analyser.fftSize = 4096
  source.connect(analyser)
  buffer = new Float32Array(analyser.fftSize)
  media.getTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      if (stream === media) stall()
    })
    // iOS mutes rather than ends the track during some interruptions.
    track.addEventListener('mute', () => {
      if (stream === media) mutedTrackSince = performance.now()
    })
    track.addEventListener('unmute', () => {
      mutedTrackSince = 0
    })
  })
  notRunningSince = 0
  deadSince = 0
  mutedTrackSince = 0
  tracker.reset()
  useMic.setState({ status: 'on' })
  raf = requestAnimationFrame(loop)
}

function loop(now: number) {
  raf = requestAnimationFrame(loop)
  if (!analyser || !buffer || !ctx || now - lastFrame < FRAME_MS) return
  lastFrame = now
  if (watchdog(now)) return
  analyser.getFloatTimeDomainData(buffer)
  const rms = rmsOf(buffer)
  // A real mic always picks up a little noise; exact zeros mean nothing's arriving.
  if (rms === 0) deadSince ||= now
  else deadSince = 0
  // About -65 dB (a quiet room) … -20 dB (a note close by) mapped to 0 … 1, rising
  // at once and falling back gently, so a struck note visibly swells and fades.
  const raw = Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-9) + 65) / 45))
  level = Math.max(raw, level * 0.8)
  levelListeners.forEach((fn) => fn(level))
  // Only look for a pitch in sounds loud enough to possibly count.
  const reading = rms > MIN_GATE ? detectPitch(buffer, ctx.sampleRate) : null
  const muted = now < mutedUntil
  tracker.frame(rms, reading, muted)
  if (frameListeners.size) {
    const frame = { rms, gate: tracker.gate, reading, muted }
    frameListeners.forEach((fn) => fn(frame))
  }
}

/** Returns true when the mic has stalled (and has been stopped). */
function watchdog(now: number): boolean {
  if (!ctx) return false
  if (ctx.state !== 'running') {
    if (!notRunningSince) {
      notRunningSince = now
      void ctx.resume().catch(() => undefined)
    }
  } else notRunningSince = 0
  const stuck =
    (notRunningSince && now - notRunningSince > STALL_MS) ||
    (deadSince && now - deadSince > DEAD_MS) ||
    (mutedTrackSince && now - mutedTrackSince > STALL_MS)
  if (stuck) stall()
  return !!stuck
}

/** Stop a mic that isn't hearing anything and ask for a tap to start it again. */
function stall() {
  stopMic()
  useMic.setState({ status: 'stalled' })
}

export function stopMic() {
  if (!stream && useMic.getState().status !== 'starting') return
  cancelAnimationFrame(raf)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  analyser?.disconnect()
  analyser = null
  void ctx?.close().catch(() => undefined)
  ctx = null
  setSession('auto')
  useMic.setState({ status: 'off' })
}

// Let go of the mic while the app is in the background (iOS would interrupt it
// anyway, and the orange dot shouldn't linger), and pick it up again on return.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!stream) return
      resumeOnShow = true
      stopMic()
    } else if (resumeOnShow) {
      resumeOnShow = false
      // Without a tap iOS may not let audio run; if so, the watchdog notices and
      // the panel offers a button.
      void startMic()
    }
  })
}
