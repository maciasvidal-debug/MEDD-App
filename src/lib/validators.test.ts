import { describe, it, expect } from 'vitest'
import { isProfileComplete, surveyMissingProfile } from './validators'
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
