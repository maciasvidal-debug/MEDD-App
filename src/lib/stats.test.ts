import { describe, it, expect } from 'vitest'
import {
  wilsonCI, quantile, prevalenceRatio, chiSquareTest, cochranArmitage,
  mantelHaenszelRR, iccBinary, breslowDay, holmAdjust, terminalDigitTest, cohenKappa,
} from './stats'

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

describe('iccBinary', () => {
  it('≈0 when clusters share the same proportion (no interviewer effect)', () => {
    const r = iccBinary([{ n: 10, cases: 5 }, { n: 10, cases: 5 }, { n: 10, cases: 5 }])
    expect(r).not.toBeNull()
    expect(r!.icc).toBeLessThan(0.05)
  })
  it('→1 when clusters are perfectly separated', () => {
    const r = iccBinary([{ n: 10, cases: 10 }, { n: 10, cases: 0 }])
    expect(r!.icc).toBeCloseTo(1, 5)
    expect(r!.designEffect).toBeGreaterThan(1)
  })
  it('returns null with fewer than 2 clusters', () => {
    expect(iccBinary([{ n: 10, cases: 5 }])).toBeNull()
  })
})

describe('breslowDay', () => {
  it('does not reject homogeneity when strata share the same OR', () => {
    const r = breslowDay([
      { a: 20, b: 10, c: 10, d: 20 },
      { a: 20, b: 10, c: 10, d: 20 },
    ])
    expect(r).not.toBeNull()
    expect(r!.df).toBe(1)
    expect(r!.p).toBeGreaterThan(0.05)
  })
  it('flags heterogeneity (effect modification) across strata', () => {
    const r = breslowDay([
      { a: 45, b: 5, c: 5, d: 45 },   // OR ≈ 81
      { a: 10, b: 10, c: 10, d: 10 }, // OR = 1
    ])
    expect(r!.p).toBeLessThan(0.05)
  })
  it('returns null with fewer than 2 usable strata', () => {
    expect(breslowDay([{ a: 5, b: 5, c: 5, d: 5 }])).toBeNull()
  })
})

describe('holmAdjust', () => {
  it('returns [] for an empty family', () => {
    expect(holmAdjust([])).toEqual([])
  })

  it('rejects a single test at its raw p', () => {
    const [r] = holmAdjust([{ key: 'a', p: 0.04 }])
    expect(r.pAdj).toBeCloseTo(0.04, 10)
    expect(r.reject).toBe(true)
  })

  it('applies the step-down scaling and stops at the first non-significant test', () => {
    // p = 0.01, 0.03, 0.04 over m=3 → adj 0.03, 0.06, 0.06; only the smallest passes.
    const res = holmAdjust([
      { key: 'x', p: 0.04 }, { key: 'y', p: 0.01 }, { key: 'z', p: 0.03 },
    ])
    expect(res.map(r => r.key)).toEqual(['y', 'z', 'x']) // ascending p
    expect(res[0].pAdj).toBeCloseTo(0.03, 10)
    expect(res[0].reject).toBe(true)
    expect(res[1].pAdj).toBeCloseTo(0.06, 10)
    expect(res[1].reject).toBe(false)
    expect(res[2].reject).toBe(false) // monotone: never rejected after a failure
  })

  it('keeps adjusted p-values monotone and capped at 1', () => {
    const res = holmAdjust([{ key: 'a', p: 0.5 }, { key: 'b', p: 0.5 }, { key: 'c', p: 0.9 }])
    expect(res.every(r => r.pAdj <= 1)).toBe(true)
    expect(res[0].pAdj).toBeLessThanOrEqual(res[1].pAdj)
    expect(res[1].pAdj).toBeLessThanOrEqual(res[2].pAdj)
    expect(res.every(r => r.reject === false)).toBe(true)
  })
})

describe('terminalDigitTest', () => {
  it('returns null with fewer than 20 values', () => {
    expect(terminalDigitTest([1, 2, 3])).toBeNull()
  })

  it('does not flag uniformly-distributed last digits', () => {
    // 0..9 repeated → perfectly uniform → chi2 ≈ 0, large p.
    const vals = Array.from({ length: 100 }, (_, i) => i % 10)
    const r = terminalDigitTest(vals)!
    expect(r.n).toBe(100)
    expect(r.df).toBe(9)
    expect(r.chi2).toBeCloseTo(0, 6)
    expect(r.p).toBeGreaterThan(0.99)
  })

  it('flags strong digit preference (all values end in 0)', () => {
    const vals = Array.from({ length: 50 }, (_, i) => (i + 1) * 10) // 10,20,…
    const r = terminalDigitTest(vals)!
    expect(r.p).toBeLessThan(0.001)
  })
})

describe('cohenKappa', () => {
  it('returns null with no pairs', () => {
    expect(cohenKappa([])).toBeNull()
  })

  it('is 1 for perfect agreement', () => {
    const r = cohenKappa([['Sí', 'Sí'], ['No', 'No'], ['Sí', 'Sí']])!
    expect(r.kappa).toBe(1)
    expect(r.agree).toBe(1)
  })

  it('is ~0 when one rater never varies (agreement is all chance)', () => {
    // Rater A always "Sí" → 80% raw agreement but no better than chance.
    const pairs: [string, string][] = [
      ...Array(8).fill(['Sí', 'Sí']), ...Array(2).fill(['Sí', 'No']),
    ]
    const r = cohenKappa(pairs)!
    expect(r.agree).toBeCloseTo(0.8, 10)
    expect(r.kappa).toBeCloseTo(0, 10)
  })

  it('matches the textbook value for a balanced 2×2 (κ = 0.6)', () => {
    const pairs: [string, string][] = [
      ...Array(4).fill(['Sí', 'Sí']), ...Array(4).fill(['No', 'No']),
      ['Sí', 'No'], ['No', 'Sí'],
    ]
    const r = cohenKappa(pairs)!
    expect(r.agree).toBeCloseTo(0.8, 10)
    expect(r.kappa).toBeCloseTo(0.6, 10)
  })

  it('goes negative for systematic disagreement', () => {
    const r = cohenKappa([['Sí', 'No'], ['No', 'Sí'], ['Sí', 'No'], ['No', 'Sí']])!
    expect(r.kappa).toBeLessThan(0)
  })
})
