import { describe, it, expect } from 'vitest'
import { toCSV, toCodebookCSV, assertVersioned } from './csv'
import type { Survey } from '../types'

describe('toCSV', () => {
  it('emits a header row plus one row per survey', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, fEta: '2026-01-01', medications: [] },
      { id: 'b', nui: 2, instrumentVersion: 2, fEta: '2026-01-02', medications: [] },
    ] as unknown as Survey[]
    const lines = toCSV(surveys).trim().split('\n')
    expect(lines.length).toBe(3) // header + 2 data rows
  })

  it('starts with a UTF-8 BOM so Excel detects the encoding', () => {
    expect(toCSV([]).charCodeAt(0)).toBe(0xfeff)
  })

  it('escapes fields containing commas, quotes or newlines', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, dir: 'Calle 1, #2', obs: 'dijo "hola"', medications: [] },
    ] as unknown as Survey[]
    const dataRow = toCSV(surveys).trim().split('\n')[1]
    expect(dataRow).toContain('"Calle 1, #2"')
    expect(dataRow).toContain('"dijo ""hola"""')
  })

  it('exports the para-data columns and derives interview duration (s)', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, medications: [],
        startedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:03:00.000Z', dataEnv: 'pilot' },
      { id: 'b', nui: 2, instrumentVersion: 2, medications: [] }, // no para-data → empty duration
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
      { id: 'a', nui: 1, instrumentVersion: 2, medications: [
        { nmMed: 'A', dci: 'x', concMed: 500, undConc: 'mg', fVto: '2027-01-01' },
        { nmMed: 'B', dci: 'y', concMed: 250, undConc: 'mg', fVto: '2027-02-01' },
      ] },
    ] as unknown as Survey[]
    const dataRow = toCSV(surveys).trim().split('\n')[1]
    expect(dataRow).toContain('A;x;500;mg;2027-01-01|B;y;250;mg;2027-02-01')
  })

  it('exports departamento as its own column right after ciudad', () => {
    expect(toCSV([]).trim().split('\n')[0]).toContain('ciudad,departamento,dir')
  })

  it('exports the household id and sampling method columns (Rec. 5)', () => {
    const header = toCSV([]).trim().split('\n')[0]
    expect(header).toContain('hogarId')
    expect(header).toContain('metodoSeleccion')
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, hogarId: 'H-ABC123',
        metodoSeleccion: 'Aleatorio simple', medications: [] },
    ] as unknown as Survey[]
    const [h, row] = toCSV(surveys).trim().split('\n')
    const cols = h.split(',')
    expect(row.split(',')[cols.indexOf('hogarId')]).toBe('H-ABC123')
    expect(row.split(',')[cols.indexOf('metodoSeleccion')]).toBe('Aleatorio simple')
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
      { id: 'a', nui: 1, instrumentVersion: 1, motNoConsumo: ['Sobró de la dosis', 'Automedicación'], medications: [
        { nmMed: 'A', dci: 'x', concMed: 500, undConc: 'mg', fVto: '2027-01-01' },
        { nmMed: 'B', dci: 'y', concMed: 250, undConc: 'mg', fVto: '2027-02-01' },
      ] },
      // no meds at all
      { id: 'b', nui: 2, instrumentVersion: 2, medications: [] },
      // free text with commas and quotes (no newline, so naive line split is safe)
      { id: 'c', nui: 3, instrumentVersion: 2, dir: 'Calle 1, #2', obs: 'dijo "hola"', medications: [] },
    ] as unknown as Survey[]
    const [header, ...rows] = toCSV(surveys).trim().split('\n')
    const cols = fieldCount(header)
    for (const r of rows) expect(fieldCount(r)).toBe(cols)
  })
})

describe('versioning guard (Rec. 1)', () => {
  it('assertVersioned throws when any survey has a null/undefined instrumentVersion', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, medications: [] },
      { id: 'b', nui: 2, medications: [] }, // sin versión → mezcla no declarada
    ] as unknown as Survey[]
    expect(() => assertVersioned(surveys)).toThrow(/sin versión/i)
    expect(() => assertVersioned(surveys)).toThrow(/b/) // reporta el id ofensor
  })

  it('assertVersioned passes when every survey declares a version (mixed 1 and 2 is OK)', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 1, medications: [] },
      { id: 'b', nui: 2, instrumentVersion: 2, medications: [] },
    ] as unknown as Survey[]
    expect(() => assertVersioned(surveys)).not.toThrow()
  })

  it('toCSV refuses to emit a dataset with a null-version record', () => {
    const surveys = [
      { id: 'a', nui: 1, medications: [] }, // instrumentVersion ausente
    ] as unknown as Survey[]
    expect(() => toCSV(surveys)).toThrow(/Export bloqueado/i)
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
