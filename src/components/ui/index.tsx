import React, { type ButtonHTMLAttributes } from 'react'

// ─── Tokens ───────────────────────────────────────────────────────────────────

export const C = {
  navy:       '#1E3A5F',
  navyLight:  '#EFF6FF',
  teal:       '#0F766E',
  tealLight:  '#CCFBF1',
  tealMid:    '#14B8A6',
  amber:      '#B45309',
  amberLight: '#FEF3C7',
  red:        '#B91C1C',
  redLight:   '#FEE2E2',
  green:      '#166534',
  greenLight: '#DCFCE7',
  gray:       '#475569',
  grayLight:  '#F1F5F9',
  border:     '#E2E8F0',
  text:       '#0F172A',
  muted:      '#64748B',
  hint:       '#5C6B7A',
  surface:    '#FFFFFF',
  bg:         '#F8FAFC',
}

// ─── Label ────────────────────────────────────────────────────────────────────

interface LabelProps { children: React.ReactNode; htmlFor?: string; required?: boolean }
export function Label({ children, htmlFor, required }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block', marginBottom: 6,
        fontSize: 11, fontWeight: 500,
        color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px',
      }}
    >
      {children}
      {required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
    </label>
  )
}

// ─── FieldError ───────────────────────────────────────────────────────────────

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" style={{ margin: '4px 0 0', fontSize: 12, color: C.red }}>
      <i className="ti ti-alert-circle" style={{ marginRight: 4, fontSize: 12 }} aria-hidden />
      {message}
    </p>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}
export function Field({ label, htmlFor, required, hint, error, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 18 }}>
      <Label htmlFor={htmlFor} required={required}>{label}</Label>
      {children}
      {hint && !error && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.hint }}>{hint}</p>
      )}
      <FieldError message={error} />
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  icon?: string
  iconRight?: string
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const btnStyles: Record<BtnVariant, React.CSSProperties> = {
  primary:   { background: C.teal,  color: '#fff', border: 'none' },
  secondary: { background: '#fff',  color: C.text, border: `0.5px solid ${C.border}` },
  ghost:     { background: 'transparent', color: C.text, border: `0.5px solid ${C.border}` },
  danger:    { background: C.red,   color: '#fff', border: 'none' },
}
const btnSizes: Record<'sm' | 'md' | 'lg', React.CSSProperties> = {
  sm: { padding: '7px 12px', fontSize: 13 },
  md: { padding: '10px 16px', fontSize: 14 },
  lg: { padding: '13px 0', fontSize: 15 },
}

export function Button({
  variant = 'primary', size = 'md', icon, iconRight, fullWidth,
  children, style, disabled, ...rest
}: BtnProps) {
  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 7, fontFamily: 'inherit', fontWeight: 500,
        borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : undefined,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.12s',
        ...btnStyles[variant],
        ...btnSizes[size],
        ...style,
      }}
      {...rest}
    >
      {icon && <i className={`ti ${icon}`} style={{ fontSize: 16 }} aria-hidden />}
      {children}
      {iconRight && <i className={`ti ${iconRight}`} style={{ fontSize: 15 }} aria-hidden />}
    </button>
  )
}

// ─── IconButton ───────────────────────────────────────────────────────────────

interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string
  label: string
  size?: number
}
export function IconButton({ icon, label, size = 40, style, ...rest }: IconBtnProps) {
  return (
    <button
      aria-label={label}
      style={{
        width: size, height: size, borderRadius: 8,
        border: `0.5px solid ${C.border}`, background: 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: C.text, flexShrink: 0,
        transition: 'background 0.12s',
        ...style,
      }}
      {...rest}
    >
      <i className={`ti ${icon}`} style={{ fontSize: Math.round(size * 0.52) }} aria-hidden />
    </button>
  )
}

// ─── Chip / ChipGroup ─────────────────────────────────────────────────────────

interface ChipProps {
  label: string
  active?: boolean
  onClick?: () => void
  disabled?: boolean
}
export function Chip({ label, active, onClick, disabled }: ChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 40, padding: '7px 14px', fontSize: 13, fontWeight: active ? 500 : 400,
        border: active ? `1.5px solid ${C.teal}` : `0.5px solid ${C.border}`,
        borderRadius: 20, cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        background: active ? C.tealLight : C.surface,
        color: active ? C.teal : C.text,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

interface ChipGroupProps {
  options: readonly string[]
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}
export function ChipGroup({ options, value, onChange, disabled }: ChipGroupProps) {
  return (
    <div role="radiogroup" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => (
        <Chip
          key={o} label={o}
          active={value === o}
          onClick={() => onChange(value === o ? '' : o)}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

// ─── YesNo toggle ─────────────────────────────────────────────────────────────

interface YesNoProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}
export function YesNo({ value, onChange, disabled }: YesNoProps) {
  const opts = [
    { label: 'Sí', color: C.teal, bg: C.tealLight },
    { label: 'No', color: C.gray, bg: C.grayLight },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {opts.map(({ label, color, bg }) => {
        const active = value === label
        return (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(active ? '' : label)}
            style={{
              padding: '11px 0', fontSize: 15, fontWeight: active ? 500 : 400,
              border: active ? `1.5px solid ${color}` : `0.5px solid ${C.border}`,
              borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
              background: active ? bg : C.surface, color: active ? color : C.text,
              opacity: disabled ? 0.5 : 1, transition: 'all 0.12s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
  as?: React.ElementType
}
export function Card({ children, style = {}, as: Tag = 'div' }: Omit<CardProps, 'className'>) {
  return (
    <Tag
      style={{
        background: C.surface, border: `0.5px solid ${C.border}`,
        borderRadius: 12, padding: '1rem 1.25rem', ...style,
      }}
    >
      {children}
    </Tag>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function Divider({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 16px' }}>
      <div style={{ flex: 1, height: '0.5px', background: C.border }} />
      {label && (
        <span style={{
          fontSize: 11, color: C.hint, textTransform: 'uppercase',
          letterSpacing: '0.5px', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      )}
      <div style={{ flex: 1, height: '0.5px', background: C.border }} />
    </div>
  )
}

// ─── SectionHead ─────────────────────────────────────────────────────────────

interface SectionHeadProps { icon: string; label: string }
export function SectionHead({ icon, label }: SectionHeadProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 8, background: C.tealLight,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 18, color: C.teal }} aria-hidden />
      </div>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: C.text }}>{label}</h2>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant = 'teal' | 'amber' | 'red' | 'green' | 'gray'
const badgeColors: Record<BadgeVariant, { bg: string; color: string }> = {
  teal:  { bg: '#CCFBF1', color: '#0F766E' },
  amber: { bg: '#FEF3C7', color: '#B45309' },
  red:   { bg: '#FEE2E2', color: '#B91C1C' },
  green: { bg: '#DCFCE7', color: '#166534' },
  gray:  { bg: '#F1F5F9', color: '#475569' },
}
export function Badge({ label, variant = 'gray' }: { label: string; variant?: BadgeVariant }) {
  const { bg, color } = badgeColors[variant]
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20,
      background: bg, color, fontWeight: 500,
    }}>
      {label}
    </span>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: string; label: string; value: string | number
  sub?: string; color?: string
}
export function StatCard({ icon, label, value, sub, color = C.teal }: StatCardProps) {
  return (
    <div style={{ background: C.bg, borderRadius: 8, padding: '14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 15, color }} aria-hidden />
        <span style={{
          fontSize: 11, color: C.muted, textTransform: 'uppercase',
          letterSpacing: '0.5px', lineHeight: 1.2,
        }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: string; title: string; description: string
  action?: React.ReactNode
}
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 24px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: C.tealLight, margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 32, color: C.teal }} aria-hidden />
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 500 }}>{title}</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
        {description}
      </p>
      {action}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 20, color = C.teal }: { size?: number; color?: string }) {
  return (
    <i
      className="ti ti-loader-2"
      aria-label="Cargando…"
      style={{
        fontSize: size, color,
        display: 'inline-block',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  )
}
