import { describe, it, expect } from 'vitest'
import {
  calcEdad, dayDiff, productMetrics, fmtDate, fmtTimestamp, todayISO, dateTag,
} from './date'

describe('calcEdad', () => {
  it('computes whole years, accounting for the birthday not yet reached', () => {
    expect(calcEdad('2026-06-03', '2000-06-03')).toBe(26)
    expect(calcEdad('2026-06-02', '2000-06-03')).toBe(25)
  })
  it('returns null for missing, invalid, or future birth dates', () => {
    expect(calcEdad('', '2000-01-01')).toBeNull()
    expect(calcEdad('2026-06-03', '2030-01-01')).toBeNull()
    expect(calcEdad('not-a-date', '2000-01-01')).toBeNull()
  })
})

describe('dayDiff', () => {
  it('returns the integer day difference (a − b)', () => {
    expect(dayDiff('2026-01-11', '2026-01-01')).toBe(10)
    expect(dayDiff('2026-01-01', '2026-01-11')).toBe(-10)
  })
  it('returns null when a date is missing', () => {
    expect(dayDiff('', '2026-01-01')).toBeNull()
  })
})

describe('productMetrics', () => {
  it('flags an expired product and computes the codebook time metrics', () => {
    const mx = productMetrics('2026-06-03', '2026-01-01', { fVto: '2026-05-01' } as never)
    expect(mx.isExpired).toBe(true)
    expect(mx.tVto).toBe(33)   // f_eta − f_vto
    expect(mx.vUtil).toBe(120) // f_vto − f_disp
  })
  it('does not flag a product whose expiry is still in the future', () => {
    const mx = productMetrics('2026-06-03', '2026-01-01', { fVto: '2027-01-01' } as never)
    expect(mx.isExpired).toBe(false)
  })
})

describe('fmtDate', () => {
  it('reformats YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(fmtDate('2026-03-09')).toBe('09/03/2026')
  })
  it('returns an em dash for empty input', () => {
    expect(fmtDate('')).toBe('—')
  })
})

describe('fmtTimestamp', () => {
  it('returns an em dash for empty input', () => {
    expect(fmtTimestamp('')).toBe('—')
  })
  it('formats a valid ISO timestamp to a non-empty localized string', () => {
    const out = fmtTimestamp('2026-03-09T14:30:00.000Z')
    expect(out).not.toBe('—')
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('todayISO / dateTag', () => {
  it('both return a YYYY-MM-DD string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(dateTag()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
