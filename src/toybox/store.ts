import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ClickSound } from '../audio/metronome'

export const MIN_BPM = 30
export const MAX_BPM = 240
export const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))

/** The toybox tools' settings, kept between visits (under "kiano-toybox"). */
export const useToybox = create<{
  bpm: number
  beats: number
  sound: ClickSound
  setBpm: (bpm: number) => void
  setBeats: (beats: number) => void
  setSound: (sound: ClickSound) => void
}>()(
  persist(
    (set) => ({
      bpm: 100,
      beats: 4,
      sound: 'click',
      setBpm: (bpm) => set({ bpm: clampBpm(bpm) }),
      setBeats: (beats) => set({ beats }),
      setSound: (sound) => set({ sound }),
    }),
    { name: 'kiano-toybox', version: 1 },
  ),
)
