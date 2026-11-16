import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CLICK_SOUNDS, type ClickSound } from '../audio/metronome'

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
      beats: 1,
      sound: 'pop',
      setBpm: (bpm) => set({ bpm: clampBpm(bpm) }),
      setBeats: (beats) => set({ beats }),
      setSound: (sound) => set({ sound }),
    }),
    {
      name: 'kiano-toybox',
      version: 3,
      migrate: (saved, version) => {
        const s = saved as { sound?: ClickSound; beats?: number }
        // Sounds came and went while they were being tried out: anything unknown is Pop.
        if (!s.sound || !CLICK_SOUNDS.includes(s.sound)) s.sound = 'pop'
        // One beat per bar is the default now; 4 was the old default, not a choice.
        if (version < 3 && s.beats === 4) s.beats = 1
        return s as never
      },
    },
  ),
)
