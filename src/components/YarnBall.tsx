import styles from './YarnBall.module.css'

/** Wound strands: each a dark line with a lighter one along its top edge. */
const UNDER = [
  'M2.8 8.6C8 6 15 6.6 21.2 11.6',
  'M2.3 12.2C8 9.6 15 10.6 20.2 16.6',
  'M4 16.6C8.5 14 13.5 15 17.2 19.6',
]
const OVER = [
  'M7.6 1.6C4.6 7 5 14 9.6 20.6',
  'M11.8 1C8.8 7 9 14.5 13.6 20.9',
  'M16.2 2C13.2 7.5 13.6 14 18 18.8',
]

function Strand({ d }: { d: string }) {
  return (
    <>
      <path d={d} className={styles.dark} />
      <path d={d} className={styles.light} transform="translate(-0.35 -0.45)" />
    </>
  )
}

/**
 * The progress bar's ball of yarn (cat mode). `done` (0–1) turns the strands, so it
 * rolls as it moves along; the light stays put, top left.
 */
export function YarnBall({ done }: { done: number }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <defs>
        <clipPath id="yarn-ball">
          <circle cx="12" cy="11" r="10" />
        </clipPath>
      </defs>
      {/* Like the buttons: a darker edge under the ball. */}
      <circle cx="12" cy="13" r="10" className={styles.edge} />
      <g clipPath="url(#yarn-ball)">
        {/* Shaded base with the lit part on top: a shadow crescent, bottom right. */}
        <circle cx="12" cy="11" r="10" className={styles.shade} />
        <circle cx="10.6" cy="9.4" r="9.4" className={styles.face} />
        <g className={styles.wind} style={{ transform: `rotate(${done * 3600}deg)` }}>
          {UNDER.map((d) => (
            <Strand key={d} d={d} />
          ))}
          {OVER.map((d) => (
            <Strand key={d} d={d} />
          ))}
        </g>
      </g>
    </svg>
  )
}
