import { IconChevronRight, IconMetronome } from '@tabler/icons-react'
import { Popover } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuiz, type Tool } from '../quiz/store'
import { Button3D } from './ui/Button3D'
import styles from './Toybox.module.css'

const TOOLS: { id: Tool; icon: ReactNode }[] = [
  { id: 'metronome', icon: <IconMetronome size={26} aria-hidden="true" /> },
]

/** The toybox: a button that springs open a menu of practice tools. */
export function Toybox({ className }: { className?: string }) {
  const { t } = useTranslation()
  const openTool = useQuiz((s) => s.openTool)
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button3D
          variant="ghost"
          size="sm"
          className={className}
          aria-label={t('toybox.open')}
        >
          <CatBoxIcon className={styles.icon} />
        </Button3D>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.menu}
          side="bottom"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-label={t('toybox.title')}
        >
          <h2 className={styles.title}>{t('toybox.title')}</h2>
          <ul className={styles.tools}>
            {TOOLS.map(({ id, icon }, i) => (
              <li key={id} style={{ '--i': i } as React.CSSProperties}>
                <button
                  type="button"
                  className={styles.tool}
                  onClick={() => {
                    setOpen(false)
                    openTool(id)
                  }}
                >
                  <span className={styles.toolIcon}>{icon}</span>
                  <span className={styles.toolText}>
                    <span className={styles.toolName}>{t(`toybox.tools.${id}.name`)}</span>
                    <span className={styles.toolHint}>{t(`toybox.tools.${id}.hint`)}</span>
                  </span>
                  <IconChevronRight size={20} aria-hidden="true" className={styles.chevron} />
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** A cat peeking out of an open box (cats love boxes), in the style of Tabler's icons. */
function CatBoxIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M7 13V5l3.6 2.6a6.5 6.5 0 0 1 2.8 0L17 5v8" />
      <path d="M5 13h14v7H5z" />
      <path d="M5 13 2 10.5M19 13l3-2.5" />
      <circle cx="10.2" cy="10.6" r=".7" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="10.6" r=".7" fill="currentColor" stroke="none" />
    </svg>
  )
}
