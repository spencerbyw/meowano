/**
 * Pitch detection for "Play the note": works out which piano key was just played
 * from microphone samples. Pure functions and a small state machine, so they can be
 * tried out on synthetic audio without a microphone.
 */

export interface PitchReading {
  freq: number
  /** 0–1: how clearly periodic the sound is (1 = a perfect tone). */
  clarity: number
}

/** Lowest/highest notes we listen for: a little beyond what the quiz can show (C2–C6). */
const MIN_FREQ = 55 // A1
const MAX_FREQ = 1600 // ~G6
/** Samples compared per lag. More is steadier but slower. */
const WINDOW = 2048
const THRESHOLD = 0.15

/**
 * The YIN algorithm (de Cheveigné & Kawahara, 2002): find the shortest lag at which
 * the signal best matches itself. Robust to a piano's strong overtones, which trip
 * up simpler peak-picking. Returns null when there's no clear pitch.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): PitchReading | null {
  const tauMin = Math.max(2, Math.floor(sampleRate / MAX_FREQ))
  const tauMax = Math.min(Math.ceil(sampleRate / MIN_FREQ), buf.length - 1 - WINDOW)
  const w = Math.min(WINDOW, buf.length - tauMax - 1)
  if (tauMax <= tauMin || w <= 0) return null

  // Difference function, then normalised by its running mean.
  const d = new Float32Array(tauMax + 1)
  d[0] = 1
  let running = 0
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0
    for (let i = 0; i < w; i++) {
      const diff = buf[i] - buf[i + tau]
      sum += diff * diff
    }
    running += sum
    d[tau] = running > 0 ? (sum * tau) / running : 1
  }

  // First dip below the threshold, followed down to its bottom.
  let tau = -1
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < THRESHOLD) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++
      tau = t
      break
    }
  }
  if (tau < 0) return null

  // Parabolic interpolation between neighbouring lags for sub-sample accuracy.
  let exact = tau
  if (tau > 1 && tau < tauMax) {
    const a = d[tau - 1]
    const b = d[tau]
    const c = d[tau + 1]
    const denom = a - 2 * b + c
    if (denom > 0) exact = tau + (a - c) / (2 * denom)
  }
  return { freq: sampleRate / exact, clarity: 1 - d[tau] }
}

export const rmsOf = (buf: Float32Array) => {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

export const midiOfFreq = (freq: number) => 69 + 12 * Math.log2(freq / 440)

/** Readings in a row that must agree before we call it a note (~120 ms at 25/s). */
const STABLE_FRAMES = 3
/** Quieter than this (RMS) counts as silence. Raised automatically in a noisy room. */
const MIN_GATE = 0.006
/** A jump in loudness this big means a new key was struck. */
const ONSET_RATIO = 1.5

/**
 * Turns a stream of readings into "she played a note" events: one per key press.
 * A held or ringing note fires once; striking again (a jump in loudness) or a
 * moment of silence lets the next note through.
 */
export class NoteTracker {
  private candidate = -1
  private count = 0
  private armed = true
  private quiet = 0
  private noise = MIN_GATE / 2
  private history: number[] = []

  private onNote: (midi: number) => void

  constructor(onNote: (midi: number) => void) {
    this.onNote = onNote
  }

  /**
   * Feed one analysis frame. While `muted` (Kiano is making a sound itself), notes
   * are heard but not reported, and the next report needs a fresh key press.
   */
  frame(rms: number, reading: PitchReading | null, muted = false) {
    // Track the room's background noise so the gate sits a little above it.
    if (rms < this.noise * 2) this.noise = this.noise * 0.98 + rms * 0.02
    const gate = Math.max(MIN_GATE, this.noise * 2.5)

    const before = this.history.length ? this.history[0] : rms
    this.history.push(rms)
    if (this.history.length > 3) this.history.shift()

    if (rms < gate) {
      if (++this.quiet >= 2) this.armed = true
      this.count = 0
      return
    }
    this.quiet = 0
    if (rms > before * ONSET_RATIO && rms > gate * 2) {
      // A new strike: start listening for its pitch afresh.
      this.armed = !muted
      this.count = 0
    }
    if (muted) this.armed = false

    if (!reading || reading.clarity < 0.8) return
    const midi = Math.round(midiOfFreq(reading.freq))
    if (midi === this.candidate) this.count++
    else {
      this.candidate = midi
      this.count = 1
    }
    if (this.count >= STABLE_FRAMES && this.armed) {
      this.armed = false
      this.onNote(midi)
    }
  }

  reset() {
    this.candidate = -1
    this.count = 0
    this.armed = true
    this.history = []
  }
}
