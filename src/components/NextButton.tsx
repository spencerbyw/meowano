import { IconArrowRight } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { Button3D } from './ui/Button3D'
import styles from './NextButton.module.css'

interface NextButtonProps {
  label: string
  onNext: () => void
  /**
   * Count down and go on by itself after this many seconds ("Play the note" with
   * auto-advance). A fuse along the button burns down meanwhile. Tapping goes now.
   */
  countdown?: number
  countdownLabel?: (secondsLeft: number) => string
  className?: string
}

export function NextButton({
  label,
  onNext,
  countdown,
  countdownLabel,
  className,
}: NextButtonProps) {
  const [left, setLeft] = useState(countdown ?? 0)
  const go = useRef(onNext)
  useEffect(() => {
    go.current = onNext
  })

  useEffect(() => {
    if (!countdown) return
    const started = performance.now()
    const id = window.setInterval(() => {
      const remaining = countdown - (performance.now() - started) / 1000
      if (remaining <= 0) {
        window.clearInterval(id)
        go.current()
      } else setLeft(Math.ceil(remaining))
    }, 100)
    return () => window.clearInterval(id)
  }, [countdown])

  const counting = !!countdown && left > 0
  return (
    <Button3D
      size="lg"
      className={[styles.next, className].filter(Boolean).join(' ')}
      onClick={onNext}
      autoFocus
    >
      {counting && countdownLabel ? countdownLabel(left) : label}
      <IconArrowRight size={24} aria-hidden="true" />
      {counting && (
        <span
          className={styles.fuse}
          style={{ animationDuration: `${countdown}s` }}
          aria-hidden="true"
        />
      )}
    </Button3D>
  )
}
