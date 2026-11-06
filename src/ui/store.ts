import { create } from 'zustand'

/** Transient UI state shared across screens. */
export const useUi = create<{
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}>()((set) => ({
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}))
