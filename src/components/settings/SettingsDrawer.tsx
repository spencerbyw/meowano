import {
  IconAdjustmentsHorizontal,
  IconCat,
  IconDeviceDesktop,
  IconEgg,
  IconMoon,
  IconMusic,
  IconPlant,
  IconPlant2,
  IconRocket,
  IconSun,
  IconTree,
  IconVolume,
  IconX,
} from '@tabler/icons-react'
import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PRESET_ORDER } from '../../settings/presets'
import { useSettings } from '../../settings/store'
import type {
  ConfirmMode,
  PositionId,
  PresetId,
  QuestionKind,
  RangeMode,
  ThemeSetting,
  TriadSet,
} from '../../settings/types'
import { useUi } from '../../ui/store'
import { Chips, Section, Segmented, StepSlider, SwitchField } from './controls'
import { ChordPreview, KeyPreview, RangePreview } from './previews'
import styles from './SettingsDrawer.module.css'

const PRESET_ICONS: Record<PresetId, ReactNode> = {
  newbie: <IconEgg size={26} />,
  beginner: <IconPlant size={26} />,
  intermediate: <IconPlant2 size={26} />,
  experienced: <IconTree size={26} />,
  anything: <IconRocket size={26} />,
}

const KINDS: QuestionKind[] = ['note', 'dyad', 'triad']
const POSITIONS: PositionId[] = ['C', 'D', 'F', 'G', 'A']
const RANGES: RangeMode[] = ['positions', 'staff', 'ledger1', 'ledger2']
const INTERVALS = [2, 3, 4, 5, 6, 7, 8]

export function SettingsDrawer() {
  const { t } = useTranslation()
  const open = useUi((s) => s.settingsOpen)
  const setOpen = useUi((s) => s.setSettingsOpen)
  const settings = useSettings()
  const { practice: p, updatePractice } = settings

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.drawer} aria-describedby={undefined}>
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>
              <IconAdjustmentsHorizontal size={26} aria-hidden="true" />
              {t('settings.title')}
            </Dialog.Title>
            <Dialog.Close className={styles.close} aria-label={t('settings.close')}>
              <IconX size={24} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className={styles.body}>
            {/* Level presets */}
            <section className={styles.presetSection} aria-labelledby="preset-title">
              <h3 id="preset-title" className={styles.presetTitle}>
                {t('settings.level')}
              </h3>
              <div
                className={styles.presets}
                role="radiogroup"
                aria-labelledby="preset-title"
              >
                {PRESET_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={settings.preset === id}
                    className={styles.preset}
                    onClick={() => settings.applyPreset(id)}
                  >
                    <span className={styles.presetIcon} aria-hidden="true">
                      {PRESET_ICONS[id]}
                    </span>
                    <span className={styles.presetText}>
                      <span className={styles.presetName}>{t(`presets.${id}`)}</span>
                      <span className={styles.presetHint}>{t(`presetHints.${id}`)}</span>
                    </span>
                  </button>
                ))}
              </div>
              {settings.preset === 'custom' && (
                <p className={styles.custom}>
                  {t('presets.custom')} — {t('presetHints.custom')}
                </p>
              )}
            </section>

            {/* Practice */}
            <Section
              title={t('settings.practice')}
              icon={<IconMusic size={22} aria-hidden="true" />}
            >
              <Chips
                label={t('settings.kinds')}
                hint={t('settings.kindsHint')}
                value={KINDS.filter((k) => p.kinds[k])}
                options={KINDS.map((k) => ({
                  value: k,
                  label: t(`settings.kindNames.${k}`),
                }))}
                onChange={(v) =>
                  updatePractice({
                    kinds: {
                      note: v.includes('note'),
                      dyad: v.includes('dyad'),
                      triad: v.includes('triad'),
                    },
                  })
                }
              />

              <Segmented
                label={t('settings.clef')}
                value={p.clef}
                options={(['treble', 'bass', 'both'] as const).map((c) => ({
                  value: c,
                  label: t(`settings.clefNames.${c}`),
                }))}
                onChange={(clef) => updatePractice({ clef })}
              />

              <Segmented
                label={t('settings.range')}
                hint={t('settings.rangeHint')}
                value={p.rangeMode}
                options={RANGES.map((r) => ({
                  value: r,
                  label: t(`settings.rangeNames.${r}`),
                }))}
                onChange={(rangeMode) => updatePractice({ rangeMode })}
                preview={p.rangeMode !== 'positions' && <RangePreview settings={p} />}
              />

              {p.rangeMode === 'positions' && (
                <Chips
                  label={t('settings.positions')}
                  hint={t('settings.positionsHint')}
                  value={p.positions}
                  options={POSITIONS.map((pos) => ({ value: pos, label: pos }))}
                  onChange={(positions) => updatePractice({ positions })}
                  preview={<RangePreview settings={p} />}
                />
              )}

              <StepSlider
                label={t('settings.keys')}
                hint={t('settings.keysHint')}
                value={p.maxKeyAccidentals}
                min={0}
                max={7}
                onChange={(maxKeyAccidentals) => updatePractice({ maxKeyAccidentals })}
                valueText={
                  p.maxKeyAccidentals === 0
                    ? t('settings.keysNone')
                    : t('settings.keysUpTo', { count: p.maxKeyAccidentals })
                }
                preview={<KeyPreview settings={p} />}
              />

              {p.maxKeyAccidentals > 0 && (
                <Chips
                  label={t('settings.keyKinds')}
                  value={[
                    ...(p.sharpKeys ? ['sharps' as const] : []),
                    ...(p.flatKeys ? ['flats' as const] : []),
                  ]}
                  options={[
                    { value: 'sharps', label: t('settings.sharps') },
                    { value: 'flats', label: t('settings.flats') },
                  ]}
                  onChange={(v) =>
                    updatePractice({
                      sharpKeys: v.includes('sharps'),
                      flatKeys: v.includes('flats'),
                    })
                  }
                />
              )}

              <SwitchField
                label={t('settings.accidentals')}
                hint={t('settings.accidentalsHint')}
                checked={p.accidentals}
                onChange={(accidentals) => updatePractice({ accidentals })}
              />

              {p.kinds.dyad && (
                <Chips
                  label={t('settings.intervals')}
                  hint={t('settings.intervalsHint')}
                  value={p.intervals.map(String)}
                  options={INTERVALS.map((n) => ({
                    value: String(n),
                    label: t(
                      `settings.intervalNames.i${n}` as 'settings.intervalNames.i2',
                    ),
                  }))}
                  onChange={(v) => updatePractice({ intervals: v.map(Number) })}
                />
              )}

              {p.kinds.triad && (
                <>
                  <Segmented
                    label={t('settings.chordSet')}
                    value={p.triadSet}
                    options={(['primary', 'diatonic'] as TriadSet[]).map((s) => ({
                      value: s,
                      label: t(`settings.chordSetNames.${s}`),
                    }))}
                    onChange={(triadSet) => updatePractice({ triadSet })}
                    preview={<ChordPreview settings={p} />}
                  />
                  <SwitchField
                    label={t('settings.inversions')}
                    hint={t('settings.inversionsHint')}
                    checked={p.inversions}
                    onChange={(inversions) => updatePractice({ inversions })}
                  />
                  <SwitchField
                    label={t('settings.extraChords')}
                    hint={t('settings.extraChordsHint')}
                    checked={p.extraChords}
                    onChange={(extraChords) => updatePractice({ extraChords })}
                  />
                </>
              )}
            </Section>

            {/* App */}
            <Section
              title={t('settings.app')}
              icon={<IconCat size={22} aria-hidden="true" />}
            >
              <Segmented<ThemeSetting>
                label={t('settings.theme')}
                value={settings.theme}
                options={[
                  {
                    value: 'system',
                    label: t('settings.themeNames.system'),
                    icon: <IconDeviceDesktop size={18} aria-hidden="true" />,
                  },
                  {
                    value: 'light',
                    label: t('settings.themeNames.light'),
                    icon: <IconSun size={18} aria-hidden="true" />,
                  },
                  {
                    value: 'dark',
                    label: t('settings.themeNames.dark'),
                    icon: <IconMoon size={18} aria-hidden="true" />,
                  },
                ]}
                onChange={settings.setTheme}
              />
              <Segmented<ConfirmMode>
                label={t('settings.confirm')}
                hint={t('settings.confirmHint')}
                value={settings.confirm}
                options={[
                  { value: 'single', label: t('settings.confirmNames.single') },
                  { value: 'double', label: t('settings.confirmNames.double') },
                ]}
                onChange={settings.setConfirm}
              />
              <SwitchField
                label={t('settings.catMode')}
                hint={t('settings.catModeHint')}
                icon={<IconCat size={22} aria-hidden="true" />}
                checked={settings.catMode}
                onChange={settings.setCatMode}
              />
              <SwitchField
                label={t('settings.sound')}
                hint={t('settings.soundHint')}
                icon={<IconVolume size={22} aria-hidden="true" />}
                checked={settings.sound}
                onChange={settings.setSound}
              />
            </Section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
