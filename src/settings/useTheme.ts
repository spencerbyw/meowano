import { useEffect } from 'react'
import { useSettings } from './store'

const THEME_COLORS = { light: '#fff8f1', dark: '#1e1a2b' }

/**
 * Safari 26 colours its status bar and URL bar from a fixed element touching the
 * top/bottom edge (our full-screen #root), but only re-reads that colour when it
 * (re)discovers the element, not when its background changes. Briefly taking #root
 * out of fixed positioning and back makes it look new, so Safari samples again.
 * It covers the same box either way, so nothing visibly moves.
 */
function resampleBrowserChrome() {
  const root = document.getElementById('root')
  if (!root) return
  root.style.position = 'absolute'
  void root.offsetHeight // apply it now
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      root.style.position = ''
    }),
  )
}

/** Keeps <html data-theme> and the browser chrome colours in sync with the setting. */
export function useApplyTheme() {
  const theme = useSettings((s) => s.theme)

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      const changed = document.documentElement.dataset.theme !== resolved
      document.documentElement.dataset.theme = resolved
      if (changed) resampleBrowserChrome()
      // Safari 26 ignores theme-color, but Chrome/Android and older Safari use it.
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
