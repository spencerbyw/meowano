import { IconSettings } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useUi } from '../../ui/store'
import { Button3D } from '../ui/Button3D'

export function SettingsButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const setOpen = useUi((s) => s.setSettingsOpen)
  return (
    <Button3D
      variant="ghost"
      size="sm"
      className={className}
      aria-label={t('settings.open')}
      onClick={() => setOpen(true)}
    >
      <IconSettings size={22} aria-hidden="true" />
    </Button3D>
  )
}
