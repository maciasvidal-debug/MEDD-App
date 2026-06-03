import React, { useEffect, useId, useRef, type ButtonHTMLAttributes } from 'react'

// ─── Tokens ───────────────────────────────────────────────────────────────────

// Tokens resolve to CSS custom properties (see global.css) so a single
// :root / [data-theme="dark"] switch re-themes the whole app — components keep
// referencing C.* unchanged. NOTE: these var() strings work in inline styles on
// HTML elements; SVG chart props (Recharts `fill`/`stroke`) can't resolve var(),
// so charts use the literal CHART palette below instead.
export const C = {
  navy:       'var(--c-navy)',
  navyLight:  'var(--c-navy-light)',
  primary:    'var(--c-primary)',
  teal:       'var(--c-teal)',
  tealLight:  'var(--c-teal-light)',
  tealMid:    'var(--c-teal-mid)',
  amber:      'var(--c-amber)',
  amberLight: 'var(--c-amber-light)',
  red:        'var(--c-red)',
  redLight:   'var(--c-red-light)',
  green:      'var(--c-green)',
  greenLight: 'var(--c-green-light)',
  gray:       'var(--c-gray)',
  grayLight:  'var(--c-gray-light)',
  border:     'var(--c-border)',
  text:       'var(--c-text)',
  muted:      'var(--c-muted)',
  hint:       'var(--c-hint)',
  surface:    'var(--c-surface)',
  surface2:   'var(--c-surface-2)',
  bg:         'var(--c-bg)',
  shadowSm:    'var(--shadow-sm)',
  shadowMd:    'var(--shadow-md)',
  shadowLg:    'var(--shadow-lg)',
  shadowBrand: 'var(--shadow-brand)',
  gradBrand:   'var(--grad-brand)',
}

// Literal palette for Recharts (SVG fills can't use CSS variables). Chosen to
// read well on both light and dark card surfaces.
export const CHART = {
  teal:   '#14B8A6',
  navy:   '#3B82F6',
  amber:  '#F59E0B',
  red:    '#EF4444',
  gray:   '#64748B',
  purple: '#8B5CF6',
  violet: '#A855F7',
  track:  'rgba(148, 163, 184, 0.22)',
  axis:   '#94A3B8',
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
  primary:   { background: C.primary, color: '#fff', border: 'none', boxShadow: C.shadowSm },
  secondary: { background: C.surface, color: C.text, border: `1px solid ${C.border}` },
  ghost:     { background: 'transparent', color: C.text, border: `1px solid ${C.border}` },
  danger:    { background: 'var(--c-danger)', color: '#fff', border: 'none' },
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
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: '1rem 1.25rem',
        boxShadow: C.shadowSm,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

// ─── Dialog ───────────────────────────────────────────────────────────────────
// Accessible modal: role="dialog" + aria-modal, focus moved in and restored on
// close, focus trapped with Tab, Escape to dismiss, and background scroll locked
// (WAI-ARIA dialog pattern). Closes on overlay click.

interface DialogProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}
export function Dialog({ title, onClose, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId  = useId()

  useEffect(() => {
    const prevFocus    = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusables.length === 0) { e.preventDefault(); return }
      const first = focusables[0]
      const last  = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface, borderRadius: '12px 12px 0 0',
          padding: '20px 16px', width: '100%', maxWidth: 520,
          maxHeight: '80vh', overflowY: 'auto', outline: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 id={titleId} style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{title}</h2>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            style={{
              width: 40, height: 40, borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', color: C.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
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
  teal:  { bg: C.tealLight,  color: C.teal },
  amber: { bg: C.amberLight, color: C.amber },
  red:   { bg: C.redLight,   color: C.red },
  green: { bg: C.greenLight, color: C.green },
  gray:  { bg: C.grayLight,  color: C.gray },
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
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '14px 14px', boxShadow: C.shadowSm,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
        }}>
          <i className={`ti ${icon}`} style={{ fontSize: 15, color }} aria-hidden />
        </span>
        <span style={{
          fontSize: 11, color: C.muted, textTransform: 'uppercase',
          letterSpacing: '0.5px', lineHeight: 1.2, fontWeight: 600,
        }}>
          {label}
        </span>
      </div>
      <div className="tnum" style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div className="tnum" style={{ fontSize: 12, color: C.muted, marginTop: -2 }}>{sub}</div>}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ height = 16, width = '100%', radius = 8, style }: {
  height?: number | string; width?: number | string; radius?: number; style?: React.CSSProperties
}) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius, ...style }} aria-hidden />
}

// Full-page skeleton shown while surveys load (replaces the bare spinner →
// perceived performance, Doherty threshold).
export function PageSkeleton() {
  return (
    <div className="page-content" aria-busy="true" aria-label="Cargando…">
      <Skeleton height={28} width="55%" style={{ marginBottom: 20 }} />
      <div className="kpi-grid" style={{ marginBottom: 18 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={92} radius={12} />
        ))}
      </div>
      <Skeleton height={180} radius={14} style={{ marginBottom: 14 }} />
      <Skeleton height={140} radius={14} />
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
