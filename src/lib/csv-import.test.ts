import { describe, it, expect } from 'vitest'
import { parseSurveysCSV, parseCSVRows } from './csv-import'
import { toCSV, assertVersioned } from './csv'
import { normalizeCiudad } from './ciudad'
// Vite `?raw` import: carga el fixture como string sin depender de node:fs
// (los tests se typechquean con `types: ["vite/client"]`, sin tipos de node).
import fixture from '../test/fixtures/MEDD_pilot_sample.csv?raw'

// Regresión de NO-REGRESIÓN sobre el export histórico del piloto. El archivo
// real (MEDD_2026-07-21.csv) contiene PII (direcciones, condiciones de salud),
// así que NO se versiona en el repo; en su lugar se usa un fixture SINTÉTICO,
// des-identificado, que reproduce fielmente el formato y los defectos conocidos
// del piloto (v1/v2 mezclados, instrumentVersion nulo, ciudad en texto libre,
// F_ETA de 2012, departamento vacío, celda medications de 5 subcampos).
//
// Validado además contra el CSV real aportado por el investigador (n=114): 114
// filas parseadas, 105 v1 + 9 v2 (0 nulas tras normalizar), ciudad 40→14
// canónicas, departamento 100% vacío, 1 F_ETA fuera de rango, 94 medicamentos.

describe('parseCSVRows (tokenizer)', () => {
  it('handles quoted commas, escaped quotes and the BOM', () => {
    const rows = parseCSVRows('﻿a,b,c\n"x,y","he said ""hi""",z\n')
    expect(rows[0]).toEqual(['a', 'b', 'c'])
    expect(rows[1]).toEqual(['x,y', 'he said "hi"', 'z'])
  })
})

describe('historical CSV regression', () => {
  const surveys = parseSurveysCSV(fixture)

  it('parses every historical row', () => {
    expect(surveys.length).toBe(4)
    for (const s of surveys) expect(typeof s.id).toBe('string')
  })

  it('normalizes the mixed/blank instrument versions to non-null (Rec. 1)', () => {
    // The pilot mixed v1 (blank version) and v2. After the fix a blank version
    // reads back as 1 — never null — so the export guard never trips.
    expect(surveys.every(s => s.instrumentVersion != null)).toBe(true)
    expect(surveys.filter(s => s.instrumentVersion === 1).length).toBe(3) // 3 v1
    expect(surveys.filter(s => s.instrumentVersion === 2).length).toBe(1) // 1 v2
    expect(() => assertVersioned(surveys)).not.toThrow()
  })

  it('re-exports the historical dataset without regression (round-trips row count)', () => {
    const csv = toCSV(surveys)
    expect(parseSurveysCSV(csv).length).toBe(4)
  })

  it('preserves the v2 motive battery and reads v1 batteries as empty', () => {
    const v2 = surveys.find(s => s.instrumentVersion === 2)!
    expect(v2.motNoConsumo).toEqual(['Sobró de la dosis', 'Automedicación'])
    expect(v2.dispFinal).toEqual(['Basura'])
    const v1 = surveys.find(s => s.id === 'id-001')!
    expect(v1.motNoConsumo).toEqual([])
  })

  it('parses the 5-subfield medications cell (no estadoVencimiento) tolerantly', () => {
    const s = surveys.find(s => s.id === 'id-002')!
    expect(s.medications).toHaveLength(2)
    expect(s.medications[0].nmMed).toBe('Winadeine')
    expect(s.medications[0].concMed).toBeNull() // campo vacío → null
    expect(s.medications[1].dci).toBe('amoxicilina')
  })

  it('parses the 7-subfield medications cell (v3, con fuenteObtencion — RBQM R8)', () => {
    const csv =
      'id,instrumentVersion,medications\n' +
      'v3,3,Dolex;acetaminofén;500;mg;2027-01-01;vigente;Dispensación EPS/IPS'
    const [s] = parseSurveysCSV(csv)
    expect(s.medications).toHaveLength(1)
    expect(s.medications[0].nmMed).toBe('Dolex')
    expect(s.medications[0].fVto).toBe('2027-01-01')
    // el 6º subcampo (estadoVencimiento, derivado) se ignora; el 7º se conserva.
    expect(s.medications[0].fuenteObtencion).toBe('Dispensación EPS/IPS')
  })

  it('keeps the historical free-text ciudad readable and canonicalizable', () => {
    // The pilot stored ciudad free-text; a raw "Barranquilla ,Atlántico" folds to
    // the same municipality as "BARRANQUILLA".
    const raw = surveys.map(s => s.ciudad)
    expect(raw).toContain('BARRANQUILLA')
    expect(normalizeCiudad('Barranquilla ,Atlántico').municipio).toBe('Barranquilla')
    expect(normalizeCiudad('BARRANQUILLA').municipio).toBe('Barranquilla')
  })

  it('reads the out-of-range historical F_ETA verbatim (import must not enforce capture rules)', () => {
    // The 2012 capture error is preserved on import (only NEW capture is blocked),
    // so historical records stay loadable/auditable.
    const bad = surveys.find(s => s.id === 'id-003')!
    expect(bad.fEta).toBe('2012-06-01')
  })
})
