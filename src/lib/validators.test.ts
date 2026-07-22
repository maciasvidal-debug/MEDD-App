import { describe, it, expect } from 'vitest'
import {
  isProfileComplete, surveyMissingProfile,
  step1Schema, step2Schema, step3Schema, step4Schema,
} from './validators'
import { DEFAULT_SETTINGS } from './constants'
import type { Settings, Survey } from '../types'

const fullProfile: Settings = {
  ...DEFAULT_SETTINGS,
  nuiEncuestador: '123',
  etrPrograma:    'Medicina',
  etrTipoInst:    'Pública',
  etrSemestre:    '8',
  etrInstitucion: 'Universidad Nacional',
}

describe('isProfileComplete', () => {
  it('is true when all five profile fields are filled', () => {
    expect(isProfileComplete(fullProfile)).toBe(true)
  })

  it('is false for the default (empty) settings', () => {
    expect(isProfileComplete(DEFAULT_SETTINGS)).toBe(false)
  })

  it('is false when any single field is missing', () => {
    const fields: (keyof Settings)[] = [
      'nuiEncuestador', 'etrPrograma', 'etrTipoInst', 'etrSemestre', 'etrInstitucion',
    ]
    for (const f of fields) {
      expect(isProfileComplete({ ...fullProfile, [f]: '' })).toBe(false)
    }
  })

  it('treats whitespace-only values as missing', () => {
    expect(isProfileComplete({ ...fullProfile, etrInstitucion: '   ' })).toBe(false)
  })
})

// Minimal survey carrying a complete surveyor profile.
const surveyWithProfile = {
  nuiEtr: 123,
  etrPrograma: 'Medicina',
  etrTipoInst: 'Pública',
  etrSemestre: 8,
  etrInstitucion: 'Universidad Nacional',
} as unknown as Survey

describe('surveyMissingProfile', () => {
  it('is false when every surveyor field is present', () => {
    expect(surveyMissingProfile(surveyWithProfile)).toBe(false)
  })

  it('is true when nuiEtr is null', () => {
    expect(surveyMissingProfile({ ...surveyWithProfile, nuiEtr: null })).toBe(true)
  })

  it('is true when etrSemestre is null (0 is not used)', () => {
    expect(surveyMissingProfile({ ...surveyWithProfile, etrSemestre: null })).toBe(true)
  })

  it('is true when any string field is empty', () => {
    expect(surveyMissingProfile({ ...surveyWithProfile, etrPrograma: '' } as Survey)).toBe(true)
    expect(surveyMissingProfile({ ...surveyWithProfile, etrInstitucion: '' })).toBe(true)
  })
})

// ─── Zod step schemas ──────────────────────────────────────────────────────

describe('step1Schema', () => {
  const valid = { fEta: '2026-01-10', nuiEtr: 123, nui: 1, hogarId: 'H-ABC123', metodoSeleccion: 'Aleatorio simple' }

  it('accepts a well-formed step', () => {
    expect(step1Schema.safeParse(valid).success).toBe(true)
  })

  it('requires hogarId and metodoSeleccion (sampling design, Rec. 5)', () => {
    expect(step1Schema.safeParse({ ...valid, hogarId: '' }).success).toBe(false)
    expect(step1Schema.safeParse({ ...valid, metodoSeleccion: '' }).success).toBe(false)
  })

  it('requires a non-empty interview date in YYYY-MM-DD format', () => {
    expect(step1Schema.safeParse({ ...valid, fEta: '' }).success).toBe(false)
    expect(step1Schema.safeParse({ ...valid, fEta: '10/01/2026' }).success).toBe(false)
  })

  it('rejects a non-positive or non-integer surveyor id', () => {
    expect(step1Schema.safeParse({ ...valid, nuiEtr: 0 }).success).toBe(false)
    expect(step1Schema.safeParse({ ...valid, nuiEtr: -5 }).success).toBe(false)
    expect(step1Schema.safeParse({ ...valid, nuiEtr: 1.5 }).success).toBe(false)
  })

  it('rejects an interview date outside the study window (Rec. 2)', () => {
    // Before the study started (the pilot exported a 2012 record).
    expect(step1Schema.safeParse({ ...valid, fEta: '2012-06-01' }).success).toBe(false)
    expect(step1Schema.safeParse({ ...valid, fEta: '2023-12-31' }).success).toBe(false)
    // In the future.
    expect(step1Schema.safeParse({ ...valid, fEta: '2999-01-01' }).success).toBe(false)
    // The study-start boundary itself is valid.
    expect(step1Schema.safeParse({ ...valid, fEta: '2024-01-01' }).success).toBe(true)
  })
})

describe('step2Schema', () => {
  const valid = {
    fNac: '1990-05-01', ciudad: 'Bogotá', departamento: 'Bogotá, D.C.', dir: '', estrato: 3,
    etnia: 'Ninguna', asSalud: 'Contributivo', estLab: 'Empleado',
    ingreso: '1-3 SMMLV', nvEstu: 'Profesional', nvPosg: '',
  }

  it('accepts a complete step', () => {
    expect(step2Schema.safeParse(valid).success).toBe(true)
  })

  it('constrains estrato to the 1–6 range (nullable/optional)', () => {
    expect(step2Schema.safeParse({ ...valid, estrato: 0 }).success).toBe(false)
    expect(step2Schema.safeParse({ ...valid, estrato: 7 }).success).toBe(false)
    expect(step2Schema.safeParse({ ...valid, estrato: null }).success).toBe(true)
  })

  it('requires the single-select demographic fields', () => {
    for (const f of ['etnia', 'asSalud', 'estLab', 'ingreso', 'nvEstu'] as const) {
      expect(step2Schema.safeParse({ ...valid, [f]: '' }).success).toBe(false)
    }
  })

  it('requires ciudad and departamento (no empty geography)', () => {
    expect(step2Schema.safeParse({ ...valid, ciudad: '' }).success).toBe(false)
    expect(step2Schema.safeParse({ ...valid, departamento: '' }).success).toBe(false)
  })

  // Cross-field rule (the deterministic gate the wizard mirrors in the UI).
  it('requires nvPosg only when nvEstu is "Posgrado"', () => {
    expect(step2Schema.safeParse({ ...valid, nvEstu: 'Posgrado', nvPosg: '' }).success).toBe(false)
    expect(step2Schema.safeParse({ ...valid, nvEstu: 'Posgrado', nvPosg: 'Maestría' }).success).toBe(true)
    // Non-postgrad with an empty sub-level must still pass.
    expect(step2Schema.safeParse({ ...valid, nvEstu: 'Profesional', nvPosg: '' }).success).toBe(true)
  })
})

describe('step4Schema — "Otro" requires its free text', () => {
  const valid = {
    medSob: 'Sí', dispMedVc: 'No', ctoDispVc: '', vtoMedNc: 'No',
    cantMed: 0, cantMedVto: 0, pesoMedNc: null,
    motNoConsumo: [] as string[], motNoConsumoOtro: '',
    motVencimiento: [] as string[], motVencimientoOtro: '',
    dispFinal: [] as string[], dispFinalOtro: '',
    conocePuntos: '', cualPunto: '',
  }

  it('accepts when no "Otro" is selected', () => {
    expect(step4Schema.safeParse(valid).success).toBe(true)
  })

  it('rejects "Otro" without its specification, across the three batteries', () => {
    expect(step4Schema.safeParse({ ...valid, motNoConsumo: ['Otro'] }).success).toBe(false)
    expect(step4Schema.safeParse({ ...valid, motVencimiento: ['Otro'] }).success).toBe(false)
    expect(step4Schema.safeParse({ ...valid, dispFinal: ['Otro'] }).success).toBe(false)
  })

  it('accepts "Otro" once specified', () => {
    expect(step4Schema.safeParse({ ...valid, motNoConsumo: ['Otro'], motNoConsumoOtro: 'donación' }).success).toBe(true)
  })
})

describe('step3Schema', () => {
  const valid = {
    perSalud: 'Buena', estSalud: 'No', prbSalud: '', conMed: '',
    medPrc: '', fPrc: '', fDisp: '', indMed: '',
  }

  it('accepts a valid step and rejects an unanswered estSalud', () => {
    expect(step3Schema.safeParse(valid).success).toBe(true)
    expect(step3Schema.safeParse({ ...valid, estSalud: '' }).success).toBe(false)
  })

  it('accepts empty dates but rejects malformed ones', () => {
    expect(step3Schema.safeParse({ ...valid, fPrc: '' }).success).toBe(true)
    expect(step3Schema.safeParse({ ...valid, fPrc: '2026-1-1' }).success).toBe(false)
    expect(step3Schema.safeParse({ ...valid, fDisp: 'ayer' }).success).toBe(false)
  })
})

describe('step4Schema', () => {
  const valid = {
    medSob: 'No', dispMedVc: '', ctoDispVc: '', vtoMedNc: '',
    cantMed: null, cantMedVto: null, pesoMedNc: null,
    motNoConsumo: [], motNoConsumoOtro: '', motVencimiento: [], motVencimientoOtro: '',
    dispFinal: [], dispFinalOtro: '', conocePuntos: '', cualPunto: '',
  }

  it('accepts a valid step and rejects an unanswered medSob', () => {
    expect(step4Schema.safeParse(valid).success).toBe(true)
    expect(step4Schema.safeParse({ ...valid, medSob: '' }).success).toBe(false)
  })

  it('rejects negative counts/weight but allows null', () => {
    expect(step4Schema.safeParse({ ...valid, cantMed: -1 }).success).toBe(false)
    expect(step4Schema.safeParse({ ...valid, cantMedVto: -1 }).success).toBe(false)
    expect(step4Schema.safeParse({ ...valid, pesoMedNc: -0.5 }).success).toBe(false)
    expect(step4Schema.safeParse({ ...valid, cantMed: 0, pesoMedNc: 0 }).success).toBe(true)
  })

  // Disposal block is mandatory once the home keeps unused meds (Rec. 2): the
  // pilot showed non-random missingness here. It must NOT block a medSob='No'
  // record (the block isn't shown then).
  it('requires the disposal block (dispMedVc, vtoMedNc) only when medSob is "Sí"', () => {
    const kept = { ...valid, medSob: 'Sí', dispMedVc: 'No', vtoMedNc: 'No' }
    expect(step4Schema.safeParse(kept).success).toBe(true)
    expect(step4Schema.safeParse({ ...kept, dispMedVc: '' }).success).toBe(false)
    expect(step4Schema.safeParse({ ...kept, vtoMedNc: '' }).success).toBe(false)
    // medSob='No' with the disposal block empty stays valid (block not applicable).
    expect(step4Schema.safeParse({ ...valid, medSob: 'No', dispMedVc: '', vtoMedNc: '' }).success).toBe(true)
  })
})
