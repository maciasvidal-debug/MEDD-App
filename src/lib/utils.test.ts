import { describe, it, expect } from 'vitest'
import {
  pct, safeNum, calcEdad, dayDiff, productMetrics,
  wilsonCI, quantile, prevalenceRatio, chiSquareTest, cochranArmitage,
  mantelHaenszelRR, toCSV, compareSortable,
} from './utils'
import type { Survey } from '../types'

describe('pct', () => {
  it('rounds the percentage', () => {
    expect(pct(1, 3)).toBe(33)
    expect(pct(1, 2)).toBe(50)
  })
  it('returns 0 for a zero/empty base (no division by zero)', () => {
    expect(pct(5, 0)).toBe(0)
    expect(pct(0, 0)).toBe(0)
  })
})

describe('safeNum', () => {
  it('passes numbers through and parses numeric strings', () => {
    expect(safeNum(42)).toBe(42)
    expect(safeNum('3.5')).toBe(3.5)
  })
  it('falls back to 0 for null/undefined/non-numeric', () => {
    expect(safeNum(null)).toBe(0)
    expect(safeNum(undefined)).toBe(0)
    expect(safeNum('abc')).toBe(0)
  })
})

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

describe('wilsonCI', () => {
  it('returns a zero-width interval when there is no base', () => {
    expect(wilsonCI(0, 0)).toEqual({ n: 0, total: 0, p: 0, lo: 0, hi: 0 })
  })
  it('brackets the point estimate within [0,1]', () => {
    const ci = wilsonCI(5, 10)
    expect(ci.p).toBe(0.5)
    expect(ci.lo).toBeGreaterThanOrEqual(0)
    expect(ci.hi).toBeLessThanOrEqual(1)
    expect(ci.lo).toBeLessThan(ci.p)
    expect(ci.hi).toBeGreaterThan(ci.p)
  })
})

describe('quantile', () => {
  it('interpolates (R type-7) and finds the median', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3)
  })
  it('returns NaN for an empty array', () => {
    expect(Number.isNaN(quantile([], 0.5))).toBe(true)
  })
})

describe('prevalenceRatio', () => {
  it('gives RR ≈ 2 when the exposed prevalence doubles the reference', () => {
    const rr = prevalenceRatio(40, 100, 20, 100)
    expect(rr.rr).toBeCloseTo(2, 5)
    expect(rr.lo).toBeLessThan(rr.rr)
    expect(rr.hi).toBeGreaterThan(rr.rr)
  })
})

describe('chiSquareTest', () => {
  it('returns df=(r-1)(c-1) and a low p for a strong association', () => {
    const res = chiSquareTest([[90, 10], [10, 90]])
    expect(res.df).toBe(1)
    expect(res.chi2).toBeGreaterThan(50)
    expect(res.p).toBeLessThan(0.001)
  })
  it('degenerates safely on an empty table', () => {
    expect(chiSquareTest([]).p).toBe(1)
  })
})

describe('cochranArmitage', () => {
  it('detects an increasing gradient', () => {
    const t = cochranArmitage([
      { score: 1, n: 100, cases: 10 },
      { score: 2, n: 100, cases: 30 },
      { score: 3, n: 100, cases: 60 },
    ])
    expect(t).not.toBeNull()
    expect(t!.direction).toBe('creciente')
    expect(t!.p).toBeLessThan(0.05)
  })
  it('returns null with no informative table', () => {
    expect(cochranArmitage([{ score: 1, n: 10, cases: 0 }])).toBeNull()
  })
})

describe('mantelHaenszelRR', () => {
  it('pools to RR ≈ 1 with no association in either stratum', () => {
    const res = mantelHaenszelRR([
      { a: 10, b: 10, c: 10, d: 10 },
      { a: 20, b: 20, c: 20, d: 20 },
    ])
    expect(res).not.toBeNull()
    expect(res!.rr).toBeCloseTo(1, 5)
    expect(res!.p).toBeGreaterThan(0.05)
    expect(res!.strata).toBe(2)
  })
  it('recovers a strong common RR ≈ 4 across strata', () => {
    // Each stratum: exposed risk 0.8, unexposed risk 0.2 → RR 4
    const res = mantelHaenszelRR([
      { a: 40, b: 10, c: 10, d: 40 },
      { a: 80, b: 20, c: 20, d: 80 },
    ])
    expect(res!.rr).toBeCloseTo(4, 1)
    expect(res!.p).toBeLessThan(0.001)
  })
  it('ignores strata without an exposure contrast and returns null when none inform', () => {
    expect(mantelHaenszelRR([{ a: 5, b: 5, c: 0, d: 0 }])).toBeNull()
    expect(mantelHaenszelRR([])).toBeNull()
  })
})

describe('compareSortable', () => {
  it('orders numbers numerically', () => {
    expect(compareSortable(2, 10)).toBeLessThan(0)
    expect(compareSortable(10, 2)).toBeGreaterThan(0)
  })
  it('orders strings with numeric-aware locale collation', () => {
    expect(compareSortable('Bogotá', 'Cali')).toBeLessThan(0)
    expect(compareSortable('item2', 'item10')).toBeLessThan(0)
  })
  it('always sorts empty values last regardless of the other operand', () => {
    expect(compareSortable(null, 5)).toBeGreaterThan(0)
    expect(compareSortable('', 'a')).toBeGreaterThan(0)
    expect(compareSortable(5, undefined)).toBeLessThan(0)
    expect(compareSortable(null, null)).toBe(0)
  })
})

describe('toCSV', () => {
  it('emits a header row plus one row per survey', () => {
    const surveys = [
      { id: 'a', nui: 1, fEta: '2026-01-01', medications: [] },
      { id: 'b', nui: 2, fEta: '2026-01-02', medications: [] },
    ] as unknown as Survey[]
    const lines = toCSV(surveys).trim().split('\n')
    expect(lines.length).toBe(3) // header + 2 data rows
  })
})
