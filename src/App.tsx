import { useQuiz } from './quiz/store'
import { QuizScreen } from './screens/QuizScreen'
import { StartScreen } from './screens/StartScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { useApplyTheme } from './settings/useTheme'

export default function App() {
  useApplyTheme()
  const screen = useQuiz((s) => s.screen)

  if (screen === 'quiz') return <QuizScreen />
  if (screen === 'summary') return <SummaryScreen />
  return <StartScreen />
}
