import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../settings/store'
import styles from './Splash.module.css'

const INTERVAL_MS = 5000

/** Minecraft-style pulsing splash text that cycles through cute lines. */
export function Splash({ className }: { className?: string }) {
  const { t } = useTranslation()
  const catMode = useSettings((s) => s.catMode)
  const lines = t(catMode ? 'splash' : 'splashPlain', { returnObjects: true }) as string[]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    // The tagline first, then a random line each time (never the same twice running).
    const id = setInterval(
      () => setIndex((i) => i + 1 + Math.floor(Math.random() * (lines.length - 1))),
      INTERVAL_MS,
    )
    return () => clearInterval(id)
  }, [lines.length])

  const line = lines[index % lines.length]
  // It hangs off the logo's right edge, so longer lines are set smaller to keep
  // them from reaching too far left.
  return (
    <span
      className={[styles.wrap, className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <span
        key={line}
        className={[
          styles.splash,
          line.length > 18 ? styles.long : line.length > 12 && styles.medium,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {line}
      </span>
    </span>
  )
}
