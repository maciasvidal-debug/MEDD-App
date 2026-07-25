import { describe, it, expect } from 'vitest'
import { toRow, fromRow, type SupabaseRow } from './sync-mapping'
import type { Survey } from '../types'

const survey: Survey = {
  id: 'abc-123',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  fEta: '2026-01-01',
  nuiEtr: 42,
  nui: 7,
  hogarId: 'H-ABC123',
  metodoSeleccion: 'Aleatorio simple',
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
  medications: [{ nmMed: 'Acetaminofén', dci: 'Paracetamol', concMed: null, undConc: '', fVto: '', fuenteObtencion: '' }],
  motNoConsumo: ['Sobró de la dosis'],
  motNoConsumoOtro: '',
  motVencimiento: ['Olvido'],
  motVencimientoOtro: '',
  dispFinal: ['Basura'],
  dispFinalOtro: '',
  conocePuntos: 'No',
  cualPunto: '',
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
    // The version-less fixture also normalizes to v1 (Rec. 1 non-null invariant).
    expect(back).toEqual({ ...survey, instrumentVersion: 1, syncStatus: 'synced' })
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

  it('round-trips the backcheck_of QC link (absent → null/undefined)', () => {
    const bc = { ...survey, backcheckOf: 'orig-1' }
    expect(toRow(bc, 'u').backcheck_of).toBe('orig-1')
    expect(fromRow(toRow(bc, 'u')).backcheckOf).toBe('orig-1')
    expect(toRow(survey, 'u').backcheck_of).toBeNull()
    expect(fromRow(toRow(survey, 'u')).backcheckOf).toBeUndefined()
  })

  it('round-trips the instrument version; a null row normalizes to v1 (Rec. 1)', () => {
    const v2 = { ...survey, instrumentVersion: 2 }
    expect(toRow(v2, 'u').instrument_version).toBe(2)
    expect(fromRow(toRow(v2, 'u')).instrumentVersion).toBe(2)
    // Write side still sends null when the local record has no version…
    expect(toRow(survey, 'u').instrument_version).toBeNull()
    // …but the read side enforces the non-null invariant: a remote row without a
    // version is a v1 record by definition, so it comes back as 1, never undefined.
    expect(fromRow(toRow(survey, 'u')).instrumentVersion).toBe(1)
  })

  it('round-trips the motive arrays and disposal fields', () => {
    const back = fromRow(toRow(survey, 'u'))
    expect(back.motNoConsumo).toEqual(['Sobró de la dosis'])
    expect(back.dispFinal).toEqual(['Basura'])
    expect(back.conocePuntos).toBe('No')
    // Empty multi-selects round-trip as [] (never null) for safe rendering.
    const empty = fromRow(toRow({ ...survey, motNoConsumo: [], dispFinal: [] }, 'u'))
    expect(empty.motNoConsumo).toEqual([])
    expect(empty.dispFinal).toEqual([])
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

  it('preserves legitimate zero values in numeric fields (0 is a value, not "empty")', () => {
    // estrato (1–6), cant_med/cant_med_vto/peso_med_nc (>= 0), nui_etr and
    // etr_semestre all accept 0 as real data. The mapping must map numerics
    // straight through (never `|| null`), or a valid 0 would be lost as null.
    const zeros = { ...survey, estrato: 0, cantMed: 0, cantMedVto: 0, pesoMedNc: 0, nuiEtr: 0, etrSemestre: 0 }
    const row = toRow(zeros, 'u')
    expect(row.estrato).toBe(0)
    expect(row.cant_med).toBe(0)
    expect(row.cant_med_vto).toBe(0)
    expect(row.peso_med_nc).toBe(0)
    expect(row.nui_etr).toBe(0)
    expect(row.etr_semestre).toBe(0)
    const back = fromRow(row)
    expect(back.estrato).toBe(0)
    expect(back.cantMed).toBe(0)
    expect(back.cantMedVto).toBe(0)
    expect(back.pesoMedNc).toBe(0)
    expect(back.nuiEtr).toBe(0)
    expect(back.etrSemestre).toBe(0)
  })

  it('round-trips departamento when present, but maps absent → undefined (not "")', () => {
    const withDep = { ...survey, departamento: 'Cundinamarca' }
    expect(toRow(withDep, 'u').departamento).toBe('Cundinamarca')
    expect(fromRow(toRow(withDep, 'u')).departamento).toBe('Cundinamarca')
    // Unlike ciudad (which normalizes to ''), an absent departamento stays
    // undefined — it is captured separately and optional by design.
    expect(toRow(survey, 'u').departamento).toBeNull()
    expect(fromRow(toRow(survey, 'u')).departamento).toBeUndefined()
  })

  it('deriva municipio_codigo (código DANE) del par canónico para la FK (RBQM R4)', () => {
    const s = { ...survey, ciudad: 'Barranquilla', departamento: 'Atlántico' }
    expect(toRow(s, 'u').municipio_codigo).toBe('08001')
    // Par que no resuelve unívocamente → NULL (la FK admite NULL, no inventa código).
    expect(toRow({ ...survey, ciudad: 'Ciudad Inexistente', departamento: 'Atlántico' }, 'u').municipio_codigo).toBeNull()
  })

  it('round-trips the medication sub-records (nested 1:N) losslessly', () => {
    const meds: Survey['medications'] = [
      // Fuente de obtención (RBQM R8) debe round-trippear por medicamento.
      { nmMed: 'Dolex', dci: 'Acetaminofén', concMed: 500, undConc: 'mg', fVto: '2027-03-01', fuenteObtencion: 'Dispensación EPS/IPS' },
      // A partially-filled row (blank concentration/unit/vencimiento) must survive intact.
      { nmMed: 'Amoxil', dci: 'Amoxicilina', concMed: null, undConc: '', fVto: '', fuenteObtencion: '' },
    ]
    const back = fromRow(toRow({ ...survey, medications: meds }, 'u'))
    expect(back.medications).toEqual(meds)
  })

  it('collapses empty optional medication fields to null in storage (view-safe)', () => {
    // An empty fVto/concMed must NOT reach the JSONB as "": the analytics view
    // casts them to date/numeric and "" is not NULL. Store null instead, then
    // restore the local invariant (fVto: '', concMed: null) on the way back.
    const meds: Survey['medications'] = [
      { nmMed: 'Amoxil', dci: 'Amoxicilina', concMed: null, undConc: '', fVto: '', fuenteObtencion: '' },
    ]
    const stored = toRow({ ...survey, medications: meds }, 'u').medications as Record<string, unknown>[]
    expect(stored[0].fVto).toBeNull()
    expect(stored[0].concMed).toBeNull()
    // A populated expiry/concentration is stored verbatim (only empties collapse).
    const full = toRow({ ...survey, medications: [
      { nmMed: 'Dolex', dci: 'Acetaminofén', concMed: 500, undConc: 'mg', fVto: '2027-03-01', fuenteObtencion: 'Compra fraccionada en farmacia' },
    ] }, 'u').medications as Record<string, unknown>[]
    expect(full[0].fVto).toBe('2027-03-01')
    expect(full[0].concMed).toBe(500)
  })

  it('defensively normalizes legacy medications that stored "" verbatim', () => {
    // Rows written by the pre-hardening mapping can carry "" for fVto/concMed.
    // fromRow must still surface a clean local shape.
    const back = fromRow({
      ...toRow(survey, 'u'),
      medications: [{ nmMed: 'X', dci: 'Y', concMed: '', undConc: '', fVto: '' }],
    })
    expect(back.medications).toEqual([{ nmMed: 'X', dci: 'Y', concMed: null, undConc: '', fVto: '', fuenteObtencion: '' }])
  })
})

describe('fromRow defensive reads from a raw Supabase row', () => {
  // The round-trip suite always feeds fromRow the output of toRow. This exercises
  // the other real path: a row straight from Postgres, which returns null for
  // empty text/array columns. fromRow must normalize those so the UI never sees
  // null where it expects a string or array (uncontrolled inputs, `.map` crashes).
  it('coerces null optional columns to safe client defaults', () => {
    const rawRow: SupabaseRow = {
      id: 'row-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      started_at: null, data_env: null, backcheck_of: null, instrument_version: null,
      f_eta: null, nui_etr: null, nui: 3,
      etr_programa: null, etr_tipo_inst: null, etr_semestre: null, etr_institucion: null,
      f_nac: null, ciudad: null, departamento: null, dir: null, estrato: null,
      etnia: null, as_salud: null, est_lab: null, ingreso: null, nv_estu: null, nv_posg: null,
      per_salud: null, est_salud: null, prb_salud: null, con_med: null, med_prc: null,
      f_prc: null, f_disp: null, ind_med: null, med_sob: null, disp_med_vc: null,
      cto_disp_vc: null, vto_med_nc: null, cant_med: null, cant_med_vto: null, peso_med_nc: null,
      medications: null,
      mot_no_consumo: null, mot_no_consumo_otro: null,
      mot_vencimiento: null, mot_vencimiento_otro: null,
      disp_final: null, disp_final_otro: null,
      conoce_puntos: null, cual_punto: null, obs: null,
    }
    const back = fromRow(rawRow)

    // Text columns → '' (never null), so controlled form inputs stay controlled.
    expect(back.fEta).toBe('')
    expect(back.ciudad).toBe('')
    expect(back.dir).toBe('')
    expect(back.obs).toBe('')
    expect(back.motNoConsumoOtro).toBe('')
    expect(back.cualPunto).toBe('')

    // Array columns → [] (never null), so the UI can `.map` unconditionally.
    expect(back.medications).toEqual([])
    expect(back.motNoConsumo).toEqual([])
    expect(back.motVencimiento).toEqual([])
    expect(back.dispFinal).toEqual([])

    // Nullable numerics stay null (a genuine "no value"), never coerced to 0.
    expect(back.estrato).toBeNull()
    expect(back.cantMed).toBeNull()
    expect(back.pesoMedNc).toBeNull()
    expect(back.nuiEtr).toBeNull()
    expect(back.etrSemestre).toBeNull()

    // Absent optional/para-data columns read back as undefined.
    expect(back.startedAt).toBeUndefined()
    expect(back.dataEnv).toBeUndefined()
    expect(back.backcheckOf).toBeUndefined()
    // …except instrumentVersion, which enforces the non-null invariant (Rec. 1):
    // an absent version means a v1 record, so it reads back as 1, never undefined.
    expect(back.instrumentVersion).toBe(1)
    expect(back.departamento).toBeUndefined()

    // Anything materialized from the server is, by definition, synced.
    expect(back.syncStatus).toBe('synced')
  })
})
