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

// Leaving the quiz (home, results) or the mic test turns the mic off.
const usesMic = (screen: string) => screen === 'quiz' || screen === 'mictest'
useQuiz.subscribe((state, prev) => {
  if (usesMic(prev.screen) && state.screen !== prev.screen) stopMic()
})
