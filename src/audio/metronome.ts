import { releaseAudio, wakeAudio } from './engine'

/**
 * The metronome's clock. Clicks are scheduled a little ahead on the audio clock
 * (not with timers, which drift and stall), and each beat is announced to
 * listeners at the moment it's actually heard, so animations land on the click.
 */

export type ClickSound =
  | 'snap'
  | 'snapCode'
  | 'snapWarm'
  | 'snapFull'
  | 'snapTight'
  | 'click'
  | 'wood'
  | 'beep'
  | 'tick'
  | 'mew'
// The snaps are to compare: the recording, the same sound made in code, and three
// takes on it. The one that sounds right stays.
export const CLICK_SOUNDS: ClickSound[] = [
  'snap',
  'snapCode',
  'snapWarm',
  'snapFull',
  'snapTight',
  'click',
  'wood',
  'beep',
  'tick',
  'mew',
]

export interface Beat {
  /** Beats since starting (0, 1, 2…). */
  count: number
  /** Where in the bar (0 is beat 1). */
  inBar: number
  accent: boolean
  /** Seconds from this beat to the next, at the tempo it was played at. */
  seconds: number
}

interface Options {
  bpm: number
  beats: number
  sound: ClickSound
}

/** How far ahead to schedule, and how often to top up. */
const LOOKAHEAD_S = 0.12
const TICK_MS = 25

let opts: Options = { bpm: 100, beats: 4, sound: 'click' }
let ctx: AudioContext | null = null
let out: GainNode | null = null
let timer: number | undefined
let frame = 0
let running = false
let count = 0
let nextTime = 0
let lastTime = 0
const queue: (Beat & { time: number })[] = []
const listeners = new Set<(beat: Beat) => void>()

export function setMetronome(next: Partial<Options>) {
  if (next.sound === 'snap' && ctx) void loadRecording(ctx)
  const retempo = next.bpm !== undefined && next.bpm !== opts.bpm
  opts = { ...opts, ...next }
  // A new tempo applies from the next beat, not after the old (maybe long) gap.
  if (running && retempo && ctx) {
    nextTime = Math.max(lastTime + 60 / opts.bpm, ctx.currentTime + 0.02)
  }
}

export function isMetronomeRunning() {
  return running
}

/** Hear each beat as it sounds. Returns an unsubscribe function. */
export function onBeat(cb: (beat: Beat) => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export async function startMetronome() {
  const c = await wakeAudio()
  if (opts.sound === 'snap') await loadRecording(c)
  stopTimers()
  ctx = c
  running = true
  count = 0
  queue.length = 0
  nextTime = c.currentTime + 0.06
  schedule()
  timer = window.setInterval(schedule, TICK_MS)
  frame = requestAnimationFrame(announce)
}

export function stopMetronome() {
  if (!running) return
  running = false
  stopTimers()
  queue.length = 0
  releaseAudio(0.3)
}

/** Play one click now, to hear what a sound is like. */
export async function previewClick(sound: ClickSound) {
  const c = await wakeAudio()
  if (sound === 'snap') await loadRecording(c)
  play(c, sound, true, c.currentTime + 0.02)
  if (!running) releaseAudio(0.4)
}

function stopTimers() {
  window.clearInterval(timer)
  cancelAnimationFrame(frame)
}

function schedule() {
  if (!ctx) return
  while (nextTime < ctx.currentTime + LOOKAHEAD_S) {
    const inBar = count % opts.beats
    const accent = inBar === 0 && opts.beats > 1
    const seconds = 60 / opts.bpm
    play(ctx, opts.sound, accent, nextTime)
    queue.push({ count, inBar, accent, seconds, time: nextTime })
    lastTime = nextTime
    nextTime += seconds
    count++
  }
}

function announce() {
  if (!ctx || !running) return
  // What's coming out of the speaker now (the output adds a little delay).
  const heard = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0)
  while (queue.length && queue[0].time <= heard) {
    const { time: _, ...beat } = queue.shift()!
    listeners.forEach((cb) => cb(beat))
  }
  frame = requestAnimationFrame(announce)
}

/* Sounds: all made here (nothing to download), short and soft. Beat 1 is higher. */

let noise: AudioBuffer | null = null

function output(c: AudioContext) {
  if (!out || out.context !== c) {
    out = c.createGain()
    out.gain.value = 0.9
    out.connect(c.destination)
  }
  return out
}

function noiseBuffer(c: AudioContext) {
  if (!noise || noise.sampleRate !== c.sampleRate) {
    noise = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return noise
}

/** A gain envelope: quick rise to `peak`, then an exponential fall over `decay`. */
function envelope(c: AudioContext, t: number, peak: number, decay: number, attack = 0.001) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  g.connect(output(c))
  return g
}

function osc(c: AudioContext, type: OscillatorType, freq: number, t: number, dur: number, to: AudioNode) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.connect(to)
  o.start(t)
  o.stop(t + dur + 0.02)
  return o
}

function burst(c: AudioContext, t: number, dur: number, filter: BiquadFilterType, freq: number, to: AudioNode) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  src.connect(f).connect(to)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

/** The recorded snap (a few milliseconds long), fetched and decoded once. */
let recording: Promise<AudioBuffer | null> | null = null
let recorded: AudioBuffer | null = null
function loadRecording(c: AudioContext) {
  recording ??= fetch(`${import.meta.env.BASE_URL}sounds/sample_snap.wav`)
    .then((r) => r.arrayBuffer())
    .then((data) => c.decodeAudioData(data))
    .then((buffer) => (recorded = buffer))
    .catch((err: unknown) => {
      console.warn('Snap sound failed to load', err)
      recording = null
      return null
    })
  return recording
}

function playBuffer(c: AudioContext, buffer: AudioBuffer, t: number, gain: number, rate = 1) {
  const src = c.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  const g = c.createGain()
  g.gain.value = gain
  src.connect(g).connect(output(c))
  src.start(t)
}

interface Ring {
  /** The ringing pitch (Hz). */
  freq: number
  /** How fast it dies away: the time (s) to fall to about a third. */
  tau: number
  /** Starting height; above 1 it's clipped flat, which gives the snap its edge. */
  drive: number
  /** Round the clipping off (tanh) instead of cutting it flat. */
  soft?: boolean
  /** Add a low thump underneath: [pitch Hz, time to die away s, level]. */
  body?: [number, number, number]
}

/**
 * The snap, worked out from the recording: a tone that rings for a few
 * milliseconds and dies away fast, starting so loud it clips. Drawn sample by
 * sample, so it's the same at any sample rate.
 */
const rings = new Map<string, AudioBuffer>()
function ringBuffer(c: AudioContext, ring: Ring) {
  const key = `${c.sampleRate}:${JSON.stringify(ring)}`
  let buffer = rings.get(key)
  if (!buffer) {
    const { freq, tau, drive, soft, body } = ring
    const seconds = Math.max(tau * 12, body ? body[1] * 8 : 0)
    const n = Math.ceil(seconds * c.sampleRate)
    buffer = c.createBuffer(1, n, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < n; i++) {
      const t = i / c.sampleRate
      const v = drive * Math.exp(-t / tau) * Math.sin(2 * Math.PI * freq * t)
      let y = soft ? Math.tanh(v) : Math.max(-1, Math.min(1, v))
      if (body) y += body[2] * Math.exp(-t / body[1]) * Math.sin(2 * Math.PI * body[0] * t)
      data[i] = y
    }
    rings.set(key, buffer)
  }
  return buffer
}

/** The recording's numbers: 1574 Hz, dying away in 0.6 ms, starting at twice full scale. */
const SNAP: Ring = { freq: 1574, tau: 0.000595, drive: 1.98 }
/** Snaps are short and very loud for their length: this sits them with the rest. */
const SNAP_LEVEL = 0.55

function play(c: AudioContext, sound: ClickSound, accent: boolean, t: number) {
  const up = accent ? 1.2 : 1
  const loud = accent ? 1.25 : 1
  switch (sound) {
    // The recorded snap; beat 1 plays it a little higher.
    case 'snap':
      if (recorded) playBuffer(c, recorded, t, SNAP_LEVEL * loud, up)
      break
    // The same sound, made in code.
    case 'snapCode':
      playBuffer(c, ringBuffer(c, { ...SNAP, freq: SNAP.freq * up }), t, SNAP_LEVEL * loud)
      break
    // Lower and rounder: more knuckle on wood than pop.
    case 'snapWarm':
      playBuffer(
        c,
        ringBuffer(c, { freq: 1080 * up, tau: 0.0009, drive: 1.6, soft: true }),
        t,
        SNAP_LEVEL * loud,
      )
      break
    // The snap with a soft low thump under it, like the table answering back.
    case 'snapFull':
      playBuffer(
        c,
        ringBuffer(c, { ...SNAP, freq: SNAP.freq * up, body: [190 * up, 0.006, 0.45] }),
        t,
        SNAP_LEVEL * 0.85 * loud,
      )
      break
    // Shorter and cleaner: the edge rounded off, so it's just a tight tick of a pop.
    case 'snapTight':
      playBuffer(
        c,
        ringBuffer(c, { freq: 1750 * up, tau: 0.00045, drive: 1.5, soft: true }),
        t,
        SNAP_LEVEL * 1.1 * loud,
      )
      break
    // Soft, short and woody-electronic: the default, easy to listen to for a while.
    case 'click': {
      const tone = envelope(c, t, accent ? 0.42 : 0.3, 0.035)
      osc(c, 'triangle', accent ? 1760 : 1320, t, 0.05, tone)
      burst(c, t, 0.01, 'bandpass', 3200, envelope(c, t, accent ? 0.18 : 0.12, 0.008))
      break
    }
    case 'wood': {
      const body = envelope(c, t, accent ? 0.55 : 0.42, 0.07)
      const o = osc(c, 'sine', accent ? 1150 : 860, t, 0.09, body)
      o.frequency.exponentialRampToValueAtTime(accent ? 1050 : 790, t + 0.07)
      osc(c, 'sine', (accent ? 1150 : 860) * 2.6, t, 0.03, envelope(c, t, 0.12, 0.02))
      burst(c, t, 0.012, 'bandpass', 2400, envelope(c, t, 0.2, 0.01))
      break
    }
    case 'beep': {
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 2600
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.12, t + 0.004)
      g.gain.setValueAtTime(accent ? 0.16 : 0.12, t + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.065)
      f.connect(g).connect(output(c))
      osc(c, 'square', accent ? 1500 : 1000, t, 0.07, f)
      break
    }
    case 'tick':
      burst(c, t, accent ? 0.07 : 0.04, 'highpass', 6500, envelope(c, t, accent ? 0.5 : 0.32, accent ? 0.06 : 0.03))
      break
    // A tiny kitten mew: a quick rise and fall in pitch.
    case 'mew': {
      const base = accent ? 1.35 : 1
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 2400
      const g = envelope(c, t, accent ? 0.3 : 0.22, 0.13, 0.012)
      f.connect(g)
      const o = osc(c, 'triangle', 620 * base, t, 0.15, f)
      o.frequency.exponentialRampToValueAtTime(980 * base, t + 0.045)
      o.frequency.exponentialRampToValueAtTime(700 * base, t + 0.14)
      break
    }
  }
}
