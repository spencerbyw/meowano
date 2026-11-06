import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/sniglet/400.css'
import '@fontsource/sniglet/800.css'
import '@fontsource-variable/nunito'
import './styles/tokens.css'
import './styles/global.css'
import './i18n'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
