import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Field, ChipGroup, CheckChipGroup, YesNo } from '../ui'

// Reusable react-hook-form field adapters. They bind the RHF Controller to the
// presentational `ui` primitives (which stay framework-agnostic), collapsing the
// repeated Field + Controller + control pattern that the survey forms use dozens
// of times. Generic over the form shape, so they keep full type-safety via
// `Control<T>` / `Path<T>`.

// Single-select chip question. `onAfterChange` runs after the field updates, for
// dependent fields (e.g. clearing a sub-level when its parent changes).
export function ChipField<T extends FieldValues>({
  control, name, label, options, required, help, error, onAfterChange,
}: {
  control:        Control<T>
  name:           Path<T>
  label:          string
  options:        readonly string[]
  required?:      boolean
  help?:          string
  error?:         string
  onAfterChange?: (val: string) => void
}) {
  return (
    <Field label={label} required={required} help={help} error={error}>
      <Controller name={name} control={control}
        render={({ field }) => (
          <ChipGroup
            options={options}
            value={(field.value as string) ?? ''}
            onChange={val => { field.onChange(val); onAfterChange?.(val) }}
          />
        )} />
    </Field>
  )
}

// Multi-select chip question backed by a string[] field.
export function MultiChipField<T extends FieldValues>({
  control, name, label, options, help, error,
}: {
  control:  Control<T>
  name:     Path<T>
  label:    string
  options:  readonly string[]
  help?:    string
  error?:   string
}) {
  return (
    <Field label={label} help={help} error={error}>
      <Controller name={name} control={control}
        render={({ field }) => (
          <CheckChipGroup
            options={options}
            value={(field.value as string[]) ?? []}
            onChange={field.onChange}
          />
        )} />
    </Field>
  )
}

// Yes/No question.
export function YesNoField<T extends FieldValues>({
  control, name, label, required, help, error,
}: {
  control:   Control<T>
  name:      Path<T>
  label:     string
  required?: boolean
  help?:     string
  error?:    string
}) {
  return (
    <Field label={label} required={required} help={help} error={error}>
      <Controller name={name} control={control}
        render={({ field }) => (
          <YesNo value={(field.value as string) ?? ''} onChange={field.onChange} />
        )} />
    </Field>
  )
}
