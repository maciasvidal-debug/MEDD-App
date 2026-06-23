import { describe, it, expect } from 'vitest'
import {
  pct, safeNum, calcEdad, dayDiff, productMetrics,
  wilsonCI, quantile, prevalenceRatio, chiSquareTest, cochranArmitage,
  mantelHaenszelRR, iccBinary, breslowDay, toCSV, compareSortable,
  fmtDate, fmtTimestamp, todayISO, dateTag, uuid, freqTable, groupSum, toCodebookCSV,
  holmAdjust, terminalDigitTest, cohenKappa,
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

  it('starts with a UTF-8 BOM so Excel detects the encoding', () => {
    expect(toCSV([]).charCodeAt(0)).toBe(0xfeff)
  })

  it('escapes fields containing commas, quotes or newlines', () => {
    const surveys = [
      { id: 'a', nui: 1, dir: 'Calle 1, #2', obs: 'dijo "hola"', medications: [] },
    ] as unknown as Survey[]
    const dataRow = toCSV(surveys).trim().split('\n')[1]
    expect(dataRow).toContain('"Calle 1, #2"')
    expect(dataRow).toContain('"dijo ""hola"""')
  })

  it('exports the para-data columns and derives interview duration (s)', () => {
    const surveys = [
      { id: 'a', nui: 1, medications: [],
        startedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:03:00.000Z', dataEnv: 'pilot' },
      { id: 'b', nui: 2, medications: [] }, // no para-data → empty duration
    ] as unknown as Survey[]
    const [header, r1, r2] = toCSV(surveys).trim().split('\n')
    expect(header).toContain('startedAt,dataEnv,duracion_s')
    const di = header.split(',').indexOf('duracion_s')
    expect(r1.split(',')[di]).toBe('180') // 3 min = 180 s
    expect(r2.split(',')[di]).toBe('')    // no para-data → blank duration
  })

  it('exports the motive columns and flattens multi-selects into one cell', () => {
    const surveys = [
      { id: 'a', nui: 1, medications: [], instrumentVersion: 2,
        motNoConsumo: ['Mejoró / cedieron los síntomas', 'Sobró de la dosis'],
        dispFinal: ['Basura'], conocePuntos: 'Sí', cualPunto: 'Farmacia X' },
    ] as unknown as Survey[]
    const [header, row] = toCSV(surveys).trim().split('\n')
    expect(header).toContain('instrumentVersion,motNoConsumo,motNoConsumoOtro')
    // Multi-select flattened with '; ' so it stays a single, unquoted cell.
    expect(row).toContain('Mejoró / cedieron los síntomas; Sobró de la dosis')
    const ci = header.split(',').indexOf('conocePuntos')
    expect(row.split(',')[ci]).toBe('Sí')
  })

  it('serialises multiple medications with ; field and | record separators', () => {
    const surveys = [
      { id: 'a', nui: 1, medications: [
        { nmMed: 'A', dci: 'x', concMed: 500, undConc: 'mg', fVto: '2027-01-01' },
        { nmMed: 'B', dci: 'y', concMed: 250, undConc: 'mg', fVto: '2027-02-01' },
      ] },
    ] as unknown as Survey[]
    const dataRow = toCSV(surveys).trim().split('\n')[1]
    expect(dataRow).toContain('A;x;500;mg;2027-01-01|B;y;250;mg;2027-02-01')
  })

  it('packs all stored products into the single "medications" column', () => {
    const header = toCSV([]).trim().split('\n')[0].split(',')
    // Exactly one medications column — not five flat sub-field columns.
    expect(header.filter(h => h === 'medications')).toHaveLength(1)
    expect(header).not.toContain('nmMed')
    expect(header[header.length - 1]).toBe('medications')
  })

  it('keeps every data row aligned with the header (no shifted columns)', () => {
    // Quote-aware field count so escaped commas/quotes don't inflate the tally.
    const fieldCount = (line: string) => {
      let count = 1, inQ = false
      for (const ch of line) {
        if (ch === '"') inQ = !inQ
        else if (ch === ',' && !inQ) count++
      }
      return count
    }
    const surveys = [
      // multiple meds + a multi-select
      { id: 'a', nui: 1, motNoConsumo: ['Sobró de la dosis', 'Automedicación'], medications: [
        { nmMed: 'A', dci: 'x', concMed: 500, undConc: 'mg', fVto: '2027-01-01' },
        { nmMed: 'B', dci: 'y', concMed: 250, undConc: 'mg', fVto: '2027-02-01' },
      ] },
      // no meds at all
      { id: 'b', nui: 2, medications: [] },
      // free text with commas and quotes (no newline, so naive line split is safe)
      { id: 'c', nui: 3, dir: 'Calle 1, #2', obs: 'dijo "hola"', medications: [] },
    ] as unknown as Survey[]
    const [header, ...rows] = toCSV(surveys).trim().split('\n')
    const cols = fieldCount(header)
    for (const r of rows) expect(fieldCount(r)).toBe(cols)
  })
})

describe('toCodebookCSV', () => {
  it('emits a BOM, the dictionary header and one row per variable', () => {
    const csv = toCodebookCSV()
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.trim().split('\n') // trim() drops the leading BOM
    expect(lines[0]).toBe('variable,etiqueta,tipo,valores')
    expect(lines.length).toBeGreaterThan(1)
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

describe('uuid', () => {
  it('produces a v4-shaped, unique identifier', () => {
    const a = uuid()
    const b = uuid()
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(a).not.toBe(b)
  })
})

describe('freqTable', () => {
  it('counts occurrences per option, including zero-count options', () => {
    const surveys = [
      { asSalud: 'Contributivo' }, { asSalud: 'Contributivo' }, { asSalud: 'Subsidiado' },
    ] as unknown as Survey[]
    const t = freqTable(surveys, 'asSalud', ['Contributivo', 'Subsidiado', 'Especial'] as const)
    expect(t).toEqual([
      { name: 'Contributivo', n: 2 },
      { name: 'Subsidiado', n: 1 },
      { name: 'Especial', n: 0 },
    ])
  })
  it('returns all-zero counts for an empty survey list', () => {
    expect(freqTable([], 'asSalud', ['Contributivo'] as const)).toEqual([{ name: 'Contributivo', n: 0 }])
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

describe('groupSum', () => {
  it('groups by a key, sums a numeric field and sorts descending', () => {
    const surveys = [
      { ciudad: 'Bogotá', cantMed: 3 },
      { ciudad: 'Bogotá', cantMed: 2 },
      { ciudad: 'Cali', cantMed: 4 },
    ] as unknown as Survey[]
    expect(groupSum(surveys, 'ciudad', 'cantMed')).toEqual([
      { name: 'Bogotá', value: 5 },
      { name: 'Cali', value: 4 },
    ])
  })
  it('buckets null/empty group keys and null sums under "Sin dato"/0', () => {
    const surveys = [
      { ciudad: '', cantMed: null },
      { ciudad: null, cantMed: 2 },
    ] as unknown as Survey[]
    expect(groupSum(surveys, 'ciudad', 'cantMed')).toEqual([{ name: 'Sin dato', value: 2 }])
  })
})
