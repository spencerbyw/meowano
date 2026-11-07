import { useState } from 'react'
import { useSettings } from '../settings/store'
import styles from './Confetti.module.css'

const COLORS = ['#ff7aae', '#a99bff', '#ffc94d', '#4fdcaa', '#59c3ff']
const COUNT = 28

function Paw() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <ellipse cx="12" cy="16" rx="5.2" ry="4.4" fill="currentColor" />
      <ellipse cx="5.5" cy="10.5" rx="2.1" ry="2.6" fill="currentColor" />
      <ellipse cx="9.5" cy="6.5" rx="2.1" ry="2.7" fill="currentColor" />
      <ellipse cx="14.5" cy="6.5" rx="2.1" ry="2.7" fill="currentColor" />
      <ellipse cx="18.5" cy="10.5" rx="2.1" ry="2.6" fill="currentColor" />
    </svg>
  )
}

function Note() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <ellipse
        cx="8"
        cy="18"
        rx="4.5"
        ry="3.4"
        fill="currentColor"
        transform="rotate(-20 8 18)"
      />
      <rect x="11.2" y="3" width="2" height="15" rx="1" fill="currentColor" />
      <path
        d="M13 3c3 1.5 5 3 5 6"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

const makePieces = () =>
  Array.from({ length: COUNT }, (_, i) => ({
    left: Math.random() * 100,
    size: 18 + Math.random() * 18,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.4,
    spin: (Math.random() - 0.5) * 540,
    drift: (Math.random() - 0.5) * 120,
    color: COLORS[i % COLORS.length],
  }))

/** A one-shot shower of paw prints (or music notes when cat mode is off). */
export function Confetti() {
  const catMode = useSettings((s) => s.catMode)
  const reduceMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches

  const [pieces] = useState(makePieces)

  if (reduceMotion) return null
  return (
    <div className={styles.layer} aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={styles.piece}
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              color: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--spin': `${p.spin}deg`,
              '--drift': `${p.drift}px`,
            } as React.CSSProperties
          }
        >
          {catMode ? <Paw /> : <Note />}
        </span>
      ))}
    </div>
  )
}
