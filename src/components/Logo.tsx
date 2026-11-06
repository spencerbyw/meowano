import styles from './Logo.module.css'

export function CatMark({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path
        d="M14.5 25 15.8 11.5c.2-1.5 1.9-2.2 3.1-1.3L28 17.4c2.6-.6 5.4-.6 8 0l9.1-7.2c1.2-.9 2.9-.2 3.1 1.3L49.5 25c2.3 3.4 3.5 7.3 3.5 11.3C53 47.5 43.6 54 32 54s-21-6.5-21-17.7c0-4 1.2-7.9 3.5-11.3Z"
        fill="var(--cat-fur)"
      />
      <path
        d="M19 14.5 26 20M45 14.5 38 20"
        stroke="var(--cat-ear)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="24" cy="35" rx="3" ry="3.6" fill="var(--cat-eye)" />
      <ellipse cx="40" cy="35" rx="3" ry="3.6" fill="var(--cat-eye)" />
      <circle cx="25" cy="33.8" r="1" fill="var(--cat-shine)" />
      <circle cx="41" cy="33.8" r="1" fill="var(--cat-shine)" />
      <path
        d="M29.6 41.2h4.8c.7 0 1 .8.6 1.3l-2.4 2.3c-.3.3-.8.3-1.1 0l-2.4-2.3c-.5-.5-.2-1.3.5-1.3Z"
        fill="var(--cat-nose)"
      />
      <path
        d="M32 45.2c-.8 1.6-2.3 2.4-4 2.1M32 45.2c.8 1.6 2.3 2.4 4 2.1"
        stroke="var(--cat-mouth)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <CatMark size={size === 'lg' ? 72 : 36} />
      <span className={styles.word}>Kiano</span>
    </span>
  )
}
