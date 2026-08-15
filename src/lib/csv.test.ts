import { describe, it, expect } from 'vitest'
import { toCSV, toAnalyticalCSV, toCodebookCSV, assertVersioned, encuestadorCluster, scrubFreeText } from './csv'
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

  it('serialises multiple medications with ; field and | record separators, incl. derived expiry state', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, fEta: '2026-01-01', medications: [
        { nmMed: 'A', dci: 'x', concMed: 500, undConc: 'mg', fVto: '2027-01-01' }, // future → vigente
        { nmMed: 'B', dci: 'y', concMed: 250, undConc: 'mg', fVto: '2025-02-01' }, // past → vencido
      ] },
    ] as unknown as Survey[]
    const dataRow = toCSV(surveys).trim().split('\n')[1]
    // 7º subcampo (fuenteObtencion) vacío en estos ítems → ';' final por producto.
    expect(dataRow).toContain('A;x;500;mg;2027-01-01;vigente;|B;y;250;mg;2025-02-01;vencido;')
  })

  it('NUNCA expone la coordenada cruda del hogar en el export (RBQM R11 · Sección 11)', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 3, geoConsent: true,
        geoLat: 10.987654, geoLng: -74.791234, geoAccuracyM: 8,
        geoCapturedAt: '2026-05-10T12:00:00Z', dir: 'Calle 5 #10-20', medications: [] },
    ] as unknown as Survey[]
    const full = toCSV(surveys)
    const analitico = toAnalyticalCSV(surveys)
    for (const out of [full, analitico]) {
      expect(out).not.toContain('10.987654')  // latitud cruda
      expect(out).not.toContain('-74.791234') // longitud cruda
      expect(out).not.toContain('geoLat')
      expect(out).not.toContain('geoLng')
    }
  })

  it('serialises fuenteObtencion as the 7th medication subfield (RBQM R8)', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 3, fEta: '2026-01-01', medications: [
        { nmMed: 'Dolex', dci: 'acetaminofén', concMed: 500, undConc: 'mg', fVto: '2027-01-01',
          fuenteObtencion: 'Dispensación EPS/IPS' },
      ] },
    ] as unknown as Survey[]
    const dataRow = toCSV(surveys).trim().split('\n')[1]
    expect(dataRow).toContain('Dolex;acetaminofén;500;mg;2027-01-01;vigente;Dispensación EPS/IPS')
  })

  it('leaves estadoVencimiento blank when fVto or fEta is missing (Rec. 4)', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, fEta: '2026-01-01', medications: [
        { nmMed: 'C', dci: 'z', concMed: null, undConc: '', fVto: '' }, // sin fVto → indeterminado
      ] },
    ] as unknown as Survey[]
    const dataRow = toCSV(surveys).trim().split('\n')[1]
    expect(dataRow).toContain('C;z;;;;;') // siete subcampos, estado y fuente vacíos
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

describe('toAnalyticalCSV — de-identified export (Rec. 6)', () => {
  const surveys = [
    { id: 'a', nui: 1, instrumentVersion: 2, nuiEtr: 1012345678,
      dir: 'Calle 1 # 2-3', prbSalud: 'hipertensión', hogarId: 'H-ABC123', medications: [] },
  ] as unknown as Survey[]

  it('omits the exact address (dir) column entirely', () => {
    const header = toAnalyticalCSV(surveys).trim().split('\n')[0].split(',')
    expect(header).not.toContain('dir')
  })

  it('pseudonymizes nuiEtr into a stable encuestadorCluster code (raw id absent)', () => {
    const [header, row] = toAnalyticalCSV(surveys).trim().split('\n')
    const cols = header.split(',')
    expect(cols).toContain('encuestadorCluster')
    expect(cols).not.toContain('nuiEtr')
    const cell = row.split(',')[cols.indexOf('encuestadorCluster')]
    expect(cell).toBe(encuestadorCluster(1012345678))
    expect(cell).toMatch(/^E-/)
    expect(row).not.toContain('1012345678') // raw surveyor id never appears
  })

  it('is deterministic and collision-stable per surveyor', () => {
    expect(encuestadorCluster(1012345678)).toBe(encuestadorCluster(1012345678))
    expect(encuestadorCluster(1)).not.toBe(encuestadorCluster(2))
    expect(encuestadorCluster(null)).toBe('')
  })

  it('keeps analytical variables incl. free-text health (no loss of analytical power)', () => {
    expect(toAnalyticalCSV(surveys)).toContain('hipertensión')
    expect(toAnalyticalCSV(surveys).trim().split('\n')[0]).toContain('prbSalud')
  })

  it('still enforces the version guard', () => {
    const bad = [{ id: 'x', nui: 1, medications: [] }] as unknown as Survey[]
    expect(() => toAnalyticalCSV(bad)).toThrow(/Export bloqueado/i)
  })

  it('scrubs incidental identifiers from free-text fields but keeps clinical content', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, medications: [],
        prbSalud: 'hipertensión, presión 120/80, cel 300 123 4567',
        obs: 'contactar juan@correo.com, cédula 12.345.678' },
    ] as unknown as Survey[]
    const out = toAnalyticalCSV(surveys)
    expect(out).toContain('hipertensión')      // contenido clínico conservado
    expect(out).toContain('120/80')            // presión (5 dígitos) conservada
    expect(out).toContain('[correo]')          // email redactado
    expect(out).toContain('[núm]')             // teléfono / cédula redactados
    expect(out).not.toContain('3001234567')
    expect(out).not.toContain('300 123 4567')
    expect(out).not.toContain('juan@correo.com')
    expect(out).not.toContain('12.345.678')
  })

  it('does NOT scrub the full (internal) export — only the analytical one', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, medications: [], prbSalud: 'cédula 12345678' },
    ] as unknown as Survey[]
    expect(toCSV(surveys)).toContain('12345678')       // export completo intacto
    expect(toAnalyticalCSV(surveys)).not.toContain('12345678')
  })
})

describe('scrubFreeText', () => {
  it('redacts emails and ≥6-digit sequences (cédulas/teléfonos), incl. separators', () => {
    expect(scrubFreeText('escribe a a.b+x@mail.co')).toBe('escribe a [correo]')
    expect(scrubFreeText('cc 12.345.678')).toBe('cc [núm]')
    expect(scrubFreeText('tel 300 123 4567')).toBe('tel [núm]')
    expect(scrubFreeText('3001234567')).toBe('[núm]')
  })

  it('preserves short numbers (dosages, quantities, blood pressure)', () => {
    expect(scrubFreeText('acetaminofén 500 mg cada 8 horas')).toBe('acetaminofén 500 mg cada 8 horas')
    expect(scrubFreeText('presión 120/80')).toBe('presión 120/80')
    expect(scrubFreeText('12345')).toBe('12345') // 5 dígitos → se conserva
  })

  it('is empty-safe', () => {
    expect(scrubFreeText('')).toBe('')
    expect(scrubFreeText(null)).toBe('')
    expect(scrubFreeText(undefined)).toBe('')
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



describe('CSV injection mitigation (CWE-1236)', () => {
  it('prefixes formula characters with a single quote', () => {
    const surveys = [
      {
        id: 'a', nui: 1, instrumentVersion: 2, medications: [],
        obs: '=1+1',
        dir: '+cmd',
        ciudad: '-5',
        departamento: '@foo',
        estrato: '1'
      }
    ] as unknown as Survey[]
    const out = toCSV(surveys)

    expect(out).toContain("'=1+1")
    expect(out).toContain("'+cmd")
    expect(out).toContain("'-5")
    expect(out).toContain("'@foo")
  })

  it('does not prefix safe strings', () => {
    const surveys = [
      { id: 'a', nui: 1, instrumentVersion: 2, medications: [], obs: 'Hello = World' }
    ] as unknown as Survey[]
    const out = toCSV(surveys)
    expect(out).toContain('Hello = World')
    expect(out).not.toContain("'Hello = World")
  })
})
