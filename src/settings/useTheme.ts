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
      // Replace the tag rather than editing it: iOS Safari doesn't always notice
      // an edited theme-color, but does pick up a new one.
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = THEME_COLORS[resolved]
      document.head.append(meta)
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
