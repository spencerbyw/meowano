import { IconCoffee, IconHeartFilled } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import styles from './Footer.module.css'

export function Footer() {
  const { t } = useTranslation()
  return (
    <footer className={styles.footer}>
      <span>
        <Trans
          i18nKey="footer.builtWith"
          components={{
            heart: (
              <IconHeartFilled
                className={styles.heart}
                size={16}
                aria-label={t('footer.heart')}
                role="img"
              />
            ),
            link: (
              <a href="https://spencerbywater.com/" target="_blank" rel="noreferrer" />
            ),
          }}
        />
      </span>
      <span aria-hidden="true">•</span>
      <a href="https://ko-fi.com/spencerbywater" target="_blank" rel="noreferrer">
        <IconCoffee size={16} aria-hidden="true" className={styles.icon} />
        {t('footer.support')}
      </a>
    </footer>
  )
}
