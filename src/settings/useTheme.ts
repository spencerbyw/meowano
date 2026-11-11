import { useEffect } from 'react'
import { useSettings } from './store'

const THEME_COLORS = { light: '#fff8f1', dark: '#1e1a2b' }

/** Keeps <html data-theme> and the browser theme-color in sync with the setting. */
export function useApplyTheme() {
  const theme = useSettings((s) => s.theme)

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = resolved
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', THEME_COLORS[resolved])
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
