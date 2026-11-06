import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PRESET, PRESETS } from './presets'
import type {
  ConfirmMode,
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
  preset: PresetId | 'custom'
  practice: PracticeSettings
  /** Questions per round; 0 means unlimited. */
  quizLength: QuizLength

  setQuizLength: (n: QuizLength) => void
  setTheme: (theme: ThemeSetting) => void
  setCatMode: (on: boolean) => void
  setConfirm: (mode: ConfirmMode) => void
  setSound: (on: boolean) => void
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
      preset: DEFAULT_PRESET,
      practice: PRESETS[DEFAULT_PRESET],
      quizLength: 10,

      setQuizLength: (quizLength) => set({ quizLength }),

      setTheme: (theme) => set({ theme }),
      setCatMode: (catMode) => set({ catMode }),
      setConfirm: (confirm) => set({ confirm }),
      setSound: (sound) => set({ sound }),
      applyPreset: (preset) => set({ preset, practice: PRESETS[preset] }),
      updatePractice: (patch) =>
        set((s) => ({ preset: 'custom', practice: { ...s.practice, ...patch } })),
    }),
    { name: 'kiano-settings', version: 1 },
  ),
)
