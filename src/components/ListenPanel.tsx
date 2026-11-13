import { IconMicrophone, IconMicrophoneOff } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { onMicLevel, startMic, useMic } from '../audio/mic'
import { Button3D } from './ui/Button3D'
import styles from './ListenPanel.module.css'

/**
 * "Play the note": stands in for the answer buttons. Shows that Kiano is listening
 * (with a ring that swells with the sound it hears), or how to turn the mic on.
 */
export function ListenPanel({ shake }: { shake?: boolean }) {
  const { t } = useTranslation()
  const status = useMic((s) => s.status)
  const ring = useRef<HTMLSpanElement>(null)

  // Drive the ring straight from the mic (25×/s) without re-rendering React.
  useEffect(
    () =>
      onMicLevel((level) => ring.current?.style.setProperty('--level', String(level))),
    [],
  )

  if (status === 'on') {
    return (
      <div className={[styles.panel, shake && styles.shake].filter(Boolean).join(' ')}>
        <span className={styles.mic} aria-hidden="true">
          <span ref={ring} className={styles.ring} />
          <IconMicrophone size={30} stroke={2.2} />
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{t('listen.listening')}</span>
          <span className={styles.hint}>{t('listen.hint')}</span>
        </span>
      </div>
    )
  }

  const message =
    status === 'starting'
      ? t('listen.starting')
      : status === 'denied'
        ? t('listen.denied')
        : status === 'unsupported'
          ? t('listen.unsupported')
          : status === 'error'
            ? t('listen.stopped')
            : t('listen.off')

  return (
    <div className={styles.panel}>
      <span className={[styles.mic, styles.micOff].join(' ')} aria-hidden="true">
        <IconMicrophoneOff size={30} stroke={2.2} />
      </span>
      <span className={styles.text}>
        <span className={styles.hint} role="status">
          {message}
        </span>
        {status !== 'starting' && status !== 'unsupported' && (
          <Button3D
            variant="secondary"
            size="sm"
            className={styles.start}
            onClick={() => void startMic()}
          >
            <IconMicrophone size={20} aria-hidden="true" />
            {t('listen.start')}
          </Button3D>
        )}
      </span>
    </div>
  )
}
