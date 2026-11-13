import { SettingsDrawer } from './components/settings/SettingsDrawer'
import { useQuiz } from './quiz/store'
import { MicTestScreen } from './screens/MicTestScreen'
import { QuizScreen } from './screens/QuizScreen'
import { StartScreen } from './screens/StartScreen'
import { StatsScreen } from './screens/StatsScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { useApplyTheme } from './settings/useTheme'

export default function App() {
  useApplyTheme()
  const screen = useQuiz((s) => s.screen)

  return (
    <>
      {screen === 'quiz' ? (
        <QuizScreen />
      ) : screen === 'summary' ? (
        <SummaryScreen />
      ) : screen === 'stats' ? (
        <StatsScreen />
      ) : screen === 'mictest' ? (
        <MicTestScreen />
      ) : (
        <StartScreen />
      )}
      <SettingsDrawer />
    </>
  )
}
