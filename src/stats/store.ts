import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ItemStats {
  /** Times this exact staff (clef + notes) was answered. */
  seen: number
  /** Times it wasn't answered right on the first try. */
  missed: number
  /** Timestamp (ms) of the last time it was answered. */
  lastSeen: number
}

interface StatsState {
  answered: number
  firstTry: number
  /** Correct-on-first-try answers in a row, carried across rounds. */
  currentStreak: number
  bestStreak: number
  daysPracticed: number
  /** Consecutive days with at least one answer. */
  dayStreak: number
  /** Local date (YYYY-MM-DD) of the last answer. */
  lastDay: string | null
  items: Record<string, ItemStats>

  record: (statKey: string, firstTry: boolean) => void
  reset: () => void
}

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const yesterday = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDay(d)
}

const EMPTY = {
  answered: 0,
  firstTry: 0,
  currentStreak: 0,
  bestStreak: 0,
  daysPracticed: 0,
  dayStreak: 0,
  lastDay: null,
  items: {},
}

let askedToKeep = false

/**
 * Ask the browser not to clear saved progress when the device runs low on space.
 * Safari and Chrome decide quietly (an app added to the Home Screen gets it);
 * Firefox may ask. Runs on the first answer, so there's something worth keeping.
 */
function keepStatsSafe() {
  if (askedToKeep) return
  askedToKeep = true
  const storage = navigator.storage
  if (!storage?.persist) return
  void storage
    .persisted()
    .then((kept) => kept || storage.persist())
    .catch(() => undefined)
}

/** Practice history, kept only on this device (localStorage, no accounts). */
export const useStats = create<StatsState>()(
  persist(
    (set) => ({
      ...EMPTY,

      record: (statKey, firstTry) => {
        keepStatsSafe()
        set((s) => {
          const today = localDay()
          const newDay = s.lastDay !== today
          const prev = s.items[statKey] ?? { seen: 0, missed: 0, lastSeen: 0 }
          const currentStreak = firstTry ? s.currentStreak + 1 : 0
          return {
            answered: s.answered + 1,
            firstTry: s.firstTry + (firstTry ? 1 : 0),
            currentStreak,
            bestStreak: Math.max(s.bestStreak, currentStreak),
            daysPracticed: s.daysPracticed + (newDay ? 1 : 0),
            dayStreak: newDay
              ? s.lastDay === yesterday()
                ? s.dayStreak + 1
                : 1
              : s.dayStreak,
            lastDay: today,
            items: {
              ...s.items,
              [statKey]: {
                seen: prev.seen + 1,
                missed: prev.missed + (firstTry ? 0 : 1),
                lastSeen: Date.now(),
              },
            },
          }
        })
      },

      reset: () => set(EMPTY),
    }),
    { name: 'kiano-stats', version: 1 },
  ),
)

/**
 * How much more often to show a staff, based on her history with it.
 * Unseen or always-right items weigh 1; frequently missed ones up to ~5.
 * The +2 in the denominator keeps a single slip from dominating.
 */
export function practiceWeight(statKey: string): number {
  const item = useStats.getState().items[statKey]
  if (!item) return 1
  return 1 + (4 * item.missed) / (item.seen + 2)
}

/** Miss rate with a little smoothing, for ranking "trickiest" items. */
export const missScore = (i: ItemStats) => (i.missed + 0.5) / (i.seen + 1)
