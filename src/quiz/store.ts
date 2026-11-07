import { create } from 'zustand'
import { generateQuestion, type Question } from '../music/generator'
import { useSettings } from '../settings/store'
import { practiceWeight, useStats } from '../stats/store'

export type Screen = 'start' | 'quiz' | 'summary' | 'stats'

export interface Result {
  question: Question
  firstTry: boolean
}

interface QuizState {
  screen: Screen
  /** Questions in this round; 0 = unlimited. */
  length: number
  question: Question | null
  /** Choices already tried and found wrong for the current question. */
  wrongPicks: number[]
  solved: boolean
  results: Result[]
  /** First-try streak within this round. */
  streak: number
  bestStreak: number
  /** All-time best streak when the round began, to spot a new record. */
  recordAtStart: number

  start: () => void
  answer: (index: number) => 'correct' | 'wrong' | 'ignored'
  next: () => void
  finish: () => void
  goHome: () => void
  showStats: () => void
}

const newQuestion = (previous?: Question | null) =>
  generateQuestion(useSettings.getState().practice, {
    previousStatKey: previous?.statKey,
    weight: practiceWeight,
  })

export const useQuiz = create<QuizState>()((set, get) => ({
  screen: 'start',
  length: 10,
  question: null,
  wrongPicks: [],
  solved: false,
  results: [],
  streak: 0,
  bestStreak: 0,
  recordAtStart: 0,

  start: () =>
    set({
      screen: 'quiz',
      length: useSettings.getState().quizLength,
      question: newQuestion(),
      wrongPicks: [],
      solved: false,
      results: [],
      streak: 0,
      bestStreak: 0,
      recordAtStart: useStats.getState().bestStreak,
    }),

  answer: (index) => {
    const { question, solved, wrongPicks, streak, bestStreak, results } = get()
    if (!question || solved || wrongPicks.includes(index)) return 'ignored'
    if (index === question.correctIndex) {
      const firstTry = wrongPicks.length === 0
      const nextStreak = firstTry ? streak + 1 : 0
      set({
        solved: true,
        streak: nextStreak,
        bestStreak: Math.max(bestStreak, nextStreak),
        results: [...results, { question, firstTry }],
      })
      useStats.getState().record(question.statKey, firstTry)
      return 'correct'
    }
    set({ wrongPicks: [...wrongPicks, index], streak: 0 })
    useStats.setState({ currentStreak: 0 })
    return 'wrong'
  },

  next: () => {
    const { length, results, question } = get()
    if (length > 0 && results.length >= length) {
      set({ screen: 'summary' })
      return
    }
    set({ question: newQuestion(question), wrongPicks: [], solved: false })
  },

  finish: () => set({ screen: 'summary' }),
  goHome: () => set({ screen: 'start', question: null }),
  showStats: () => set({ screen: 'stats' }),
}))
