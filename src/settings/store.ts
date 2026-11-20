import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PRESET, PRESETS } from './presets'
import type {
  ConfirmMode,
  PlayInput,
  PracticeSettings,
  PresetId,
  QuizLength,
  ThemeSetting,
} from './types'

interface SettingsState {
  theme: ThemeSetting
  catMode: boolean
  confirm: ConfirmMode
  sound: boolean
  /**
   * iPhone: play through the ring/silent switch. Needs iOS's "playback" audio
   * session, which also shows Kiano in the Dynamic Island and pauses other audio.
   */
  silentMode: boolean
  /** "Play the note": after a right note, go on to the next by itself. */
  autoAdvance: boolean
  /** How long Next counts down before going on (0.5–5 s). */
  autoAdvanceSeconds: number
  /** "Play the note": answer on a real piano (heard by the mic) or on the screen. */
  playInput: PlayInput
  preset: PresetId | 'custom'
  practice: PracticeSettings
  /** Questions per round; 0 means unlimited. */
  quizLength: QuizLength

  setQuizLength: (n: QuizLength) => void
  setTheme: (theme: ThemeSetting) => void
  setCatMode: (on: boolean) => void
  setConfirm: (mode: ConfirmMode) => void
  setSound: (on: boolean) => void
  setSilentMode: (on: boolean) => void
  setAutoAdvance: (on: boolean) => void
  setAutoAdvanceSeconds: (seconds: number) => void
  setPlayInput: (input: PlayInput) => void
  applyPreset: (preset: PresetId) => void
  updatePractice: (patch: Partial<PracticeSettings>) => void
}

/** Persisted under "kiano-settings"; index.html reads `state.theme` before first paint. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      catMode: true,
      confirm: 'double',
      sound: true,
      silentMode: true,
      autoAdvance: true,
      autoAdvanceSeconds: 2,
      playInput: 'mic',
      preset: DEFAULT_PRESET,
      practice: PRESETS[DEFAULT_PRESET],
      quizLength: 10,

      setQuizLength: (quizLength) => set({ quizLength }),

      setTheme: (theme) => set({ theme }),
      setCatMode: (catMode) => set({ catMode }),
      setConfirm: (confirm) => set({ confirm }),
      setSound: (sound) => set({ sound }),
      setSilentMode: (silentMode) => set({ silentMode }),
      setAutoAdvance: (autoAdvance) => set({ autoAdvance }),
      setAutoAdvanceSeconds: (autoAdvanceSeconds) => set({ autoAdvanceSeconds }),
      setPlayInput: (playInput) => set({ playInput }),
      applyPreset: (preset) => set({ preset, practice: PRESETS[preset] }),
      updatePractice: (patch) =>
        set((s) => ({ preset: 'custom', practice: { ...s.practice, ...patch } })),
    }),
    {
      name: 'kiano-settings',
      version: 3,
      migrate: (saved, version) => {
        const s = saved as Partial<SettingsState>
        // v2 added `octaves`: take it from the saved level, or off for a custom mix.
        if (version < 2 && s.practice) {
          const preset = s.preset && s.preset !== 'custom' ? PRESETS[s.preset] : null
          s.practice = { ...s.practice, octaves: preset?.octaves ?? false }
        }
        // v3 reworked the levels: a saved level takes on its new settings. A custom
        // mix stays as it is.
        if (version < 3 && s.preset && s.preset !== 'custom') {
          s.practice = PRESETS[s.preset]
        }
        return s as SettingsState
      },
    },
  ),
)
