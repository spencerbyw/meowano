import { unlockAudio } from '../audio/engine'
import { startMic, stopMic } from '../audio/mic'
import { useSettings } from '../settings/store'
import { useQuiz, type QuizMode } from './store'

/** Start a round from a tap: wakes the audio (and the mic for "Play the note") first. */
export function beginRound(mode: QuizMode) {
  if (useSettings.getState().sound) unlockAudio()
  if (mode === 'play') void startMic()
  useQuiz.getState().start(mode)
}

// Leaving the quiz (home, results) turns the mic off.
useQuiz.subscribe((state, prev) => {
  if (prev.screen === 'quiz' && state.screen !== 'quiz') stopMic()
})
