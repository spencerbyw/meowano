import { create } from 'zustand'
import { detectPitch, NoteTracker, rmsOf } from './pitch'

/**
 * The microphone for "Play the note". Start it from a tap (iOS needs a user
 * gesture to start audio), then listen with `onNotePlayed`.
 */

export type MicStatus = 'off' | 'starting' | 'on' | 'denied' | 'unsupported' | 'error'

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
let buffer: Float32Array<ArrayBuffer> | null = null

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

/** Loudness 0–1, for a "can you hear me" meter. */
export function onMicLevel(fn: (level: number) => void) {
  levelListeners.add(fn)
  return () => void levelListeners.delete(fn)
}

function setSession(type: string) {
  const session = (navigator as AudioSessionNavigator).audioSession
  if (session && session.type !== type) session.type = type
}

export async function startMic() {
  if (stream || useMic.getState().status === 'starting') return
  if (!navigator.mediaDevices?.getUserMedia) {
    useMic.setState({ status: 'unsupported' })
    return
  }
  useMic.setState({ status: 'starting' })
  // iOS: record and play at once (otherwise starting the mic silences Kiano).
  setSession('play-and-record')
  // A context made in the tap handler is allowed to run; make it before awaiting.
  ctx ??= new AudioContext()
  const resumed = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
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
  if (useMic.getState().status !== 'starting') {
    media.getTracks().forEach((t) => t.stop())
    return
  }
  stream = media
  const source = ctx.createMediaStreamSource(media)
  analyser = ctx.createAnalyser()
  analyser.fftSize = 4096
  source.connect(analyser)
  buffer = new Float32Array(analyser.fftSize)
  // iOS ends the mic when the app goes to the background.
  media.getTracks().forEach((track) =>
    track.addEventListener('ended', () => {
      if (stream?.getTracks().every((t) => t.readyState === 'ended')) {
        stopMic()
        useMic.setState({ status: 'error' })
      }
    }),
  )
  tracker.reset()
  useMic.setState({ status: 'on' })
  raf = requestAnimationFrame(loop)
}

function loop(now: number) {
  raf = requestAnimationFrame(loop)
  if (!analyser || !buffer || !ctx || now - lastFrame < FRAME_MS) return
  lastFrame = now
  analyser.getFloatTimeDomainData(buffer)
  const rms = rmsOf(buffer)
  // Roughly -60 dB … -10 dB mapped to 0 … 1.
  const level = Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-9) + 60) / 50))
  levelListeners.forEach((fn) => fn(level))
  const reading = rms > 0.004 ? detectPitch(buffer, ctx.sampleRate) : null
  tracker.frame(rms, reading, now < mutedUntil)
}

export function stopMic() {
  if (!stream && useMic.getState().status !== 'starting') return
  cancelAnimationFrame(raf)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  analyser?.disconnect()
  analyser = null
  if (ctx?.state === 'running') void ctx.suspend()
  setSession('auto')
  useMic.setState({ status: 'off' })
}
