import { Slider, Switch, ToggleGroup } from 'radix-ui'
import { useId, type ReactNode } from 'react'
import styles from './controls.module.css'

export function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {icon}
        {title}
      </h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

/** A labelled setting. `children` is the control; `preview` sits underneath. */
export function Field({
  label,
  hint,
  children,
  preview,
  labelId,
}: {
  label: string
  hint?: string
  children: ReactNode
  preview?: ReactNode
  labelId?: string
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldText}>
        <span id={labelId} className={styles.fieldLabel}>
          {label}
        </span>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </div>
      {children}
      {preview && <div className={styles.preview}>{preview}</div>}
    </div>
  )
}

export function SwitchField({
  label,
  hint,
  icon,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  icon?: ReactNode
  checked: boolean
  onChange: (on: boolean) => void
}) {
  const id = useId()
  return (
    <div className={styles.switchField}>
      {icon && <span className={styles.switchIcon}>{icon}</span>}
      <label htmlFor={id} className={styles.fieldText}>
        <span className={styles.fieldLabel}>{label}</span>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </label>
      <Switch.Root
        id={id}
        className={styles.switch}
        checked={checked}
        onCheckedChange={onChange}
      >
        <Switch.Thumb className={styles.thumb} />
      </Switch.Root>
    </div>
  )
}

export interface Option<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

export function Segmented<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  preview,
}: {
  label: string
  hint?: string
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  preview?: ReactNode
}) {
  const id = useId()
  return (
    <Field label={label} hint={hint} labelId={id} preview={preview}>
      <ToggleGroup.Root
        type="single"
        aria-labelledby={id}
        className={styles.segmented}
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
      >
        {options.map((o) => (
          <ToggleGroup.Item key={o.value} value={o.value} className={styles.segment}>
            {o.icon}
            <span>{o.label}</span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </Field>
  )
}

/** Multi-select chips. Never lets the last selected chip be turned off. */
export function Chips<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  preview,
}: {
  label: string
  hint?: string
  value: T[]
  options: Option<T>[]
  onChange: (v: T[]) => void
  preview?: ReactNode
}) {
  const id = useId()
  return (
    <Field label={label} hint={hint} labelId={id} preview={preview}>
      <ToggleGroup.Root
        type="multiple"
        aria-labelledby={id}
        className={styles.chips}
        value={value}
        onValueChange={(v) =>
          v.length && onChange(options.map((o) => o.value).filter((o) => v.includes(o)))
        }
      >
        {options.map((o) => (
          <ToggleGroup.Item key={o.value} value={o.value} className={styles.chip}>
            {o.icon}
            <span>{o.label}</span>
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </Field>
  )
}

export function StepSlider({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  valueText,
  preview,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  valueText: string
  preview?: ReactNode
}) {
  const id = useId()
  return (
    <Field label={label} hint={hint} labelId={id} preview={preview}>
      <div className={styles.sliderRow}>
        <Slider.Root
          className={styles.slider}
          value={[value]}
          min={min}
          max={max}
          step={1}
          onValueChange={([v]) => onChange(v)}
          aria-labelledby={id}
        >
          <Slider.Track className={styles.track}>
            <Slider.Range className={styles.range} />
          </Slider.Track>
          <Slider.Thumb
            className={styles.sliderThumb}
            aria-valuetext={valueText}
            aria-labelledby={id}
          />
        </Slider.Root>
        <span className={styles.sliderValue} aria-hidden="true">
          {valueText}
        </span>
      </div>
    </Field>
  )
}
