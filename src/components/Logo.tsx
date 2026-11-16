import type { ReactNode } from 'react'
import { PeekCat } from './PeekCat'
import styles from './Logo.module.css'

export type CatMood = 'idle' | 'happy' | 'surprised'

interface LogoProps {
  size?: 'sm' | 'lg'
  mood?: CatMood
  /** When set, the cat becomes a button (the start-screen petting easter egg). */
  onCatClick?: () => void
  catLabel?: string
  catClassName?: string
  /**
   * Make the word an <h1> (with `children` inside it). Keeps the cat button out of
   * the heading, so it doesn't read as "Pet the cat Kiano".
   */
  asHeading?: boolean
  children?: ReactNode
}

export function Logo({
  size = 'lg',
  mood = 'idle',
  onCatClick,
  catLabel,
  catClassName,
  asHeading,
  children,
}: LogoProps) {
  const Word = asHeading ? 'h1' : 'span'
  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      {/* The cat's alive: it blinks, watches your taps, and naps if left alone. */}
      <PeekCat
        variant="head"
        mood={mood === 'happy' ? 'happy' : mood === 'surprised' ? 'curious' : 'idle'}
        sleepy
        onPet={onCatClick}
        petLabel={onCatClick ? catLabel : undefined}
        className={[styles.cat, catClassName].filter(Boolean).join(' ')}
      />
      <Word className={styles.word}>
        Kiano
        {children}
      </Word>
    </span>
  )
}
