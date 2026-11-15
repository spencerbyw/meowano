import styles from './YarnBall.module.css'

/**
 * The progress bar's ball of yarn (cat mode): a few chunky strands, which hold up
 * at this small size. Two wrap round the middle, with more at right angles above
 * and below. `done` (0–1) turns the strands, so it rolls as it moves along.
 */

/** Strands across the middle (before the -30° tilt). */
const BAND = [9.4, 14]
/** Strands at right angles, above and below the band. */
const CAPS = [3, 9, 15, 21]

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
      <circle cx="12" cy="11" r="10" className={styles.face} />
      <g clipPath="url(#yarn-ball)">
        <g className={styles.wind} style={{ transform: `rotate(${done * 3600}deg)` }}>
          <g transform="rotate(-30 12 11)">
            {CAPS.map((x) => (
              <path
                key={x}
                d={`M${x} -2Q${x + 2.6} 11 ${x} 24`}
                className={styles.strand}
              />
            ))}
            {/* The band covers the caps where it crosses them. */}
            <path
              d="M-2 6.8Q12 9.4 26 6.8V15.6Q12 18.2-2 15.6Z"
              className={styles.face}
            />
            {BAND.map((y) => (
              <path
                key={y}
                d={`M-2 ${y}Q12 ${y + 2.6} 26 ${y}`}
                className={styles.strand}
              />
            ))}
          </g>
        </g>
      </g>
    </svg>
  )
}
