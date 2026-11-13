import { create } from 'zustand'
import { generateQuestion, type Question } from '../music/generator'
import { midiOf } from '../music/theory'
import { useSettings } from '../settings/store'
import { practiceWeight, useStats } from '../stats/store'

export type Screen = 'start' | 'quiz' | 'summary' | 'stats'

/**
 * - quiz: pick the answer from three choices
 * - play: play the note on the piano; the mic listens (single notes only)
 */
export type QuizMode = 'quiz' | 'play'

export interface Result {
  question: Question
  firstTry: boolean
}

/** A question put off with "Don't know", waiting to come back. */
interface Deferred {
  question: Question
  /** A wrong pick was made before skipping, so it can't count as first-try. */
  hadMiss: boolean
  /** Unlimited rounds: comes back once this many questions are done. */
  dueAt: number
}

/** In unlimited rounds (no "end"), a skipped question returns after this many more. */
const UNLIMITED_RETURN_AFTER = 3

interface QuizState {
  screen: Screen
  mode: QuizMode
  /** Questions in this round; 0 = unlimited. */
  length: number
  question: Question | null
  /** Choices already tried and found wrong for the current question. */
  wrongPicks: number[]
  /** Play mode: wrong notes played for the current question (MIDI numbers). */
  wrongNotes: number[]
  solved: boolean
  results: Result[]
  /** First-try streak within this round. */
  streak: number
  bestStreak: number
  /** All-time best streak when the round began, to spot a new record. */
  recordAtStart: number
  /** Skipped questions, served again at the end of the round. */
  deferred: Deferred[]
  /** The current question was skipped before; skipping again gives up on it. */
  isReturn: boolean
  /** The current question already had a wrong pick before it was skipped. */
  hadMiss: boolean
  /** The current question was given up on and its answer revealed. */
  gaveUp: boolean

  start: (mode?: QuizMode) => void
  answer: (index: number) => 'correct' | 'wrong' | 'ignored'
  /** Play mode: she played this note (MIDI number). Must match exactly, octave too. */
  answerNote: (midi: number) => 'correct' | 'wrong' | 'ignored'
  next: () => void
  /** "Don't know": put the question off, or give up if it's already been put off. */
  skip: () => 'deferred' | 'gaveUp' | 'ignored'
  finish: () => void
  goHome: () => void
  showStats: () => void
}

const newQuestion = (mode: QuizMode, previous?: Question | null) => {
  const practice = useSettings.getState().practice
  return generateQuestion(
    // Playing it: single notes only, and the octave always matters.
    mode === 'play'
      ? { ...practice, kinds: { note: true, dyad: false, triad: false }, octaves: true }
      : practice,
    { previousStatKey: previous?.statKey, weight: practiceWeight },
  )
}

const freshQuestion = {
  wrongPicks: [],
  wrongNotes: [],
  solved: false,
  isReturn: false,
  hadMiss: false,
  gaveUp: false,
}

export const useQuiz = create<QuizState>()((set, get) => {
  /** Move on: a new question, a returning skipped one, or the summary. */
  const advance = () => {
    const { length, results, question, deferred, mode } = get()
    if (length > 0 && results.length >= length) {
      set({ screen: 'summary' })
      return
    }
    const freshLeft = length > 0 ? length - results.length - deferred.length : Infinity
    const due = deferred[0]
    if (due && (freshLeft <= 0 || due.dueAt <= results.length)) {
      set({
        ...freshQuestion,
        question: due.question,
        deferred: deferred.slice(1),
        isReturn: true,
        hadMiss: due.hadMiss,
      })
      return
    }
    set({ ...freshQuestion, question: newQuestion(mode, question) })
  }

  /** The current question was answered right; returns the outcome for the caller. */
  const solve = () => {
    const { question, wrongPicks, wrongNotes, streak, bestStreak, results, hadMiss } =
      get()
    if (!question) return 'ignored' as const
    const firstTry = wrongPicks.length === 0 && wrongNotes.length === 0 && !hadMiss
    const nextStreak = firstTry ? streak + 1 : 0
    set({
      solved: true,
      streak: nextStreak,
      bestStreak: Math.max(bestStreak, nextStreak),
      results: [...results, { question, firstTry }],
    })
    useStats.getState().record(question.statKey, firstTry)
    return 'correct' as const
  }

  const miss = (patch: Partial<QuizState>) => {
    set({ ...patch, streak: 0 })
    useStats.setState({ currentStreak: 0 })
    return 'wrong' as const
  }

  return {
    screen: 'start',
    mode: 'quiz',
    length: 10,
    question: null,
    results: [],
    streak: 0,
    bestStreak: 0,
    recordAtStart: 0,
    deferred: [],
    ...freshQuestion,

    start: (mode = 'quiz') =>
      set({
        ...freshQuestion,
        screen: 'quiz',
        mode,
        length: useSettings.getState().quizLength,
        question: newQuestion(mode),
        deferred: [],
        results: [],
        streak: 0,
        bestStreak: 0,
        recordAtStart: useStats.getState().bestStreak,
      }),

    answer: (index) => {
      const { question, solved, wrongPicks } = get()
      if (!question || solved || wrongPicks.includes(index)) return 'ignored'
      if (index === question.correctIndex) return solve()
      return miss({ wrongPicks: [...wrongPicks, index] })
    },

    answerNote: (midi) => {
      const { question, solved, wrongNotes } = get()
      if (!question || solved) return 'ignored'
      if (midi === midiOf(question.notes[0])) return solve()
      return miss({ wrongNotes: [...wrongNotes, midi] })
    },

    next: advance,

    skip: () => {
      const {
        question,
        solved,
        isReturn,
        hadMiss,
        wrongPicks,
        wrongNotes,
        results,
        deferred,
        length,
      } = get()
      if (!question || solved) return 'ignored'
      // Not knowing breaks the first-try streak either way.
      useStats.setState({ currentStreak: 0 })
      if (isReturn) {
        // Second "Don't know" on the same question: it counts as missed.
        set({
          solved: true,
          gaveUp: true,
          streak: 0,
          results: [...results, { question, firstTry: false }],
        })
        useStats.getState().record(question.statKey, false)
        return 'gaveUp'
      }
      set({
        streak: 0,
        deferred: [
          ...deferred,
          {
            question,
            hadMiss: hadMiss || wrongPicks.length > 0 || wrongNotes.length > 0,
            dueAt: length > 0 ? Infinity : results.length + UNLIMITED_RETURN_AFTER,
          },
        ],
      })
      advance()
      return 'deferred'
    },

    finish: () => set({ screen: 'summary' }),
    goHome: () => set({ screen: 'start', question: null }),
    showStats: () => set({ screen: 'stats' }),
  }
})
