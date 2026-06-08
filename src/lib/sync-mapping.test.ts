import { describe, it, expect } from 'vitest'
import { toRow, fromRow } from './sync-mapping'
import type { Survey } from '../types'

const survey: Survey = {
  id: 'abc-123',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  fEta: '2026-01-01',
  nuiEtr: 42,
  nui: 7,
  etrPrograma: 'Medicina',
  etrTipoInst: 'Pública',
  etrSemestre: 8,
  etrInstitucion: 'Universidad Nacional',
  fNac: '1990-05-05',
  ciudad: 'Bogotá',
  dir: 'Calle 1',
  estrato: 3,
  etnia: 'Ninguna',
  asSalud: 'Contributivo',
  estLab: 'Empleado',
  ingreso: '1-3 SMMLV',
  nvEstu: 'Profesional',
  nvPosg: '',
  perSalud: 'Buena',
  estSalud: 'No',
  prbSalud: '',
  conMed: 'Sí',
  medPrc: 'No',
  fPrc: '',
  fDisp: '2025-12-01',
  indMed: 'Sí',
  medSob: 'Sí',
  dispMedVc: 'No',
  ctoDispVc: '',
  vtoMedNc: 'Sí',
  cantMed: 5,
  cantMedVto: 2,
  pesoMedNc: 12.5,
  medications: [{ nmMed: 'Acetaminofén', dci: 'Paracetamol' } as Survey['medications'][number]],
  obs: 'sin novedad',
  syncStatus: 'local',
}

describe('sync mapping toRow/fromRow', () => {
  it('stamps the owner user_id from the argument, never the survey', () => {
    const row = toRow(survey, 'user-xyz')
    expect(row.user_id).toBe('user-xyz')
    expect(row.id).toBe('abc-123')
    expect(row.nui).toBe(7)
  })

  it('round-trips every business field (fromRow ∘ toRow) and marks it synced', () => {
    const back = fromRow(toRow(survey, 'user-xyz'))
    // syncStatus is always normalized to 'synced' on the way back from remote.
    expect(back).toEqual({ ...survey, syncStatus: 'synced' })
  })

  it('maps empty strings to null in the row (clean storage) and back to empty strings', () => {
    const row = toRow({ ...survey, ciudad: '', obs: '' }, 'u')
    expect(row.ciudad).toBeNull()
    expect(row.obs).toBeNull()
    const back = fromRow(row)
    expect(back.ciudad).toBe('')
    expect(back.obs).toBe('')
  })

  it('round-trips the started_at para-data (absent → null/undefined)', () => {
    const withStart = { ...survey, startedAt: '2026-01-01T09:55:00.000Z' }
    expect(toRow(withStart, 'u').started_at).toBe('2026-01-01T09:55:00.000Z')
    expect(fromRow(toRow(withStart, 'u')).startedAt).toBe('2026-01-01T09:55:00.000Z')
    expect(toRow(survey, 'u').started_at).toBeNull()
    expect(fromRow(toRow(survey, 'u')).startedAt).toBeUndefined()
  })

  it('reads data_env from the row but never sends it (server-authoritative)', () => {
    // toRow omits data_env so the DB trigger stamps it from the account.
    expect('data_env' in toRow(survey, 'u')).toBe(false)
    // fromRow surfaces it for the client (e.g. investigator env filtering).
    expect(fromRow({ ...toRow(survey, 'u'), data_env: 'prod' }).dataEnv).toBe('prod')
    expect(fromRow(toRow(survey, 'u')).dataEnv).toBeUndefined()
  })

  it('preserves null numeric fields (not coerced to 0)', () => {
    const row = toRow({ ...survey, estrato: null, cantMed: null, pesoMedNc: null, nuiEtr: null, etrSemestre: null }, 'u')
    expect(row.estrato).toBeNull()
    expect(row.cant_med).toBeNull()
    const back = fromRow(row)
    expect(back.estrato).toBeNull()
    expect(back.cantMed).toBeNull()
    expect(back.etrSemestre).toBeNull()
  })
})
