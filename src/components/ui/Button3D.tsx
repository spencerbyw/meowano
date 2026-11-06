import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button3D.module.css'

export type ButtonVariant =
  'primary' | 'secondary' | 'choice' | 'pending' | 'success' | 'error' | 'ghost'

interface Button3DProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  /** Keeps the button looking pressed in (e.g. a selected toggle). */
  pressed?: boolean
  children: ReactNode
  frontClassName?: string
}

/**
 * Squishy "3D" button, after Josh Comeau's
 * https://www.joshwcomeau.com/animation/3d-button/
 */
export function Button3D({
  variant = 'primary',
  size = 'md',
  pressed = false,
  className,
  frontClassName,
  children,
  type = 'button',
  ...rest
}: Button3DProps) {
  return (
    <button
      type={type}
      className={[
        styles.pushable,
        styles[variant],
        styles[size],
        pressed && styles.pressed,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <span className={styles.shadow} aria-hidden="true" />
      <span className={styles.edge} aria-hidden="true" />
      <span className={[styles.front, frontClassName].filter(Boolean).join(' ')}>
        {children}
      </span>
    </button>
  )
}
