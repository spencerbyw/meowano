import { useEffect, useState } from 'react'
import { useSettings } from '../settings/store'
import styles from './PawTaps.module.css'

interface Stamp {
  id: number
  x: number
  y: number
  turn: number
}

let nextId = 0

/** Cat mode: every tap leaves a little paw print that fades away. */
export function PawTaps() {
  const catMode = useSettings((s) => s.catMode)
  const [stamps, setStamps] = useState<Stamp[]>([])

  useEffect(() => {
    if (!catMode) return
    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) return
      const stamp = {
        id: nextId++,
        x: e.clientX,
        y: e.clientY,
        turn: Math.round(Math.random() * 50 - 25),
      }
      setStamps((s) => [...s.slice(-5), stamp])
      window.setTimeout(() => setStamps((s) => s.filter((p) => p.id !== stamp.id)), 800)
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onDown)
  }, [catMode])

  if (!stamps.length) return null
  return (
    <div className={styles.layer} aria-hidden="true">
      {stamps.map((p) => (
        <svg
          key={p.id}
          viewBox="0 0 24 24"
          className={styles.paw}
          style={{ left: p.x, top: p.y, '--turn': `${p.turn}deg` } as React.CSSProperties}
        >
          <ellipse cx="12" cy="16" rx="5.2" ry="4.4" />
          <ellipse cx="5.5" cy="10.5" rx="2.1" ry="2.6" />
          <ellipse cx="9.5" cy="6.5" rx="2.1" ry="2.7" />
          <ellipse cx="14.5" cy="6.5" rx="2.1" ry="2.7" />
          <ellipse cx="18.5" cy="10.5" rx="2.1" ry="2.6" />
        </svg>
      ))}
    </div>
  )
}
