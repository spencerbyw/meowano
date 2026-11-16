import { IconChevronRight, IconHorseToy, IconMetronome } from '@tabler/icons-react'
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
          <IconHorseToy size={24} aria-hidden="true" className={styles.icon} />
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
