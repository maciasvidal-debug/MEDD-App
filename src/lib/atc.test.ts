import { describe, it, expect } from 'vitest'
import { therapeuticGroup, therapeuticSubgroup, normalizeDci, SIN_CLASIFICAR } from './atc'

describe('normalizeDci', () => {
  it('lowercases, strips accents and collapses whitespace', () => {
    expect(normalizeDci('  Ácido   Ascórbico ')).toBe('acido ascorbico')
    expect(normalizeDci('Amoxicilina')).toBe('amoxicilina')
  })
  it('is empty-safe', () => {
    expect(normalizeDci('')).toBe('')
  })
})

describe('therapeuticGroup', () => {
  it('classifies clean active ingredients', () => {
    expect(therapeuticGroup('amoxicilina')).toBe('Antiinfecciosos')
    expect(therapeuticGroup('amlodipino')).toBe('Cardiovascular')
    expect(therapeuticGroup('meloxicam')).toBe('Musculoesquelético')
    expect(therapeuticGroup('acetaminofen')).toBe('Sistema nervioso')
    expect(therapeuticGroup('salbutamol')).toBe('Respiratorio')
    expect(therapeuticGroup('omeprazol')).toBe('Digestivo y metabolismo')
  })

  it('is robust to salt suffixes, concentrations and "equivalente a" noise', () => {
    expect(therapeuticGroup('Amoxicilina trihidrato (1048.97) equivalente a amoxicilina')).toBe('Antiinfecciosos')
    expect(therapeuticGroup('amlodipino besilato 13.87 mgequivalente a amlodipino base')).toBe('Cardiovascular')
    expect(therapeuticGroup('naproxeno 500')).toBe('Musculoesquelético')
    expect(therapeuticGroup('losartan 50 mg potasico')).toBe('Cardiovascular')
  })

  it('is accent-insensitive', () => {
    expect(therapeuticGroup('ácido ascorbico')).toBe('Digestivo y metabolismo')
    expect(therapeuticGroup('ácido acetilsalicílico')).toBe('Sistema nervioso')
  })

  it('orders rules so broad A-group tokens do not steal dermatological/cardio matches', () => {
    // "calamina (óxido de zinc…)" must be Dermatológicos, not Digestivo (zinc).
    expect(therapeuticGroup('calamina (oxido de zinc: 5g + ariabel sienna: 0.02g)')).toBe('Dermatológicos')
    // "rosuvastatina cálcica" must be Cardiovascular, not caught by "calcio".
    expect(therapeuticGroup('rosuvastatina calcica equivalente a rosuvastatina')).toBe('Cardiovascular')
  })

  it('classifies a cold-combo by its decongestant/antihistamine component', () => {
    expect(therapeuticGroup('acetaminofen, fenilefrina, clorfeniramina')).toBe('Respiratorio')
  })

  it('routes herbal/homeopathic to its own bucket', () => {
    expect(therapeuticGroup('chancapiedra')).toBe('Fitoterapéutico/homeopático')
    expect(therapeuticGroup('homeopatico complejo')).toBe('Fitoterapéutico/homeopático')
  })

  it('returns SIN_CLASIFICAR for unknown or empty input', () => {
    expect(therapeuticGroup('')).toBe(SIN_CLASIFICAR)
    expect(therapeuticGroup('xyz sustancia inexistente')).toBe(SIN_CLASIFICAR)
  })
})

describe('therapeuticSubgroup (ATC level 2)', () => {
  it('classifies into ATC level-2 subgroups', () => {
    expect(therapeuticSubgroup('amoxicilina')).toBe('Antibacterianos (J01)')
    expect(therapeuticSubgroup('meloxicam')).toBe('AINE / antirreumáticos (M01)')
    expect(therapeuticSubgroup('amlodipino')).toBe('Calcioantagonistas (C08)')
    expect(therapeuticSubgroup('losartan 50 mg potasico')).toBe('IECA / ARA-II (C09)')
    expect(therapeuticSubgroup('acetaminofen')).toBe('Analgésicos (N02)')
    expect(therapeuticSubgroup('omeprazol')).toBe('Antiácidos / antiulcerosos (A02)')
  })

  it('level 1 stays consistent with level 2 (same anatomical letter)', () => {
    // empagliflozina → A10 (antidiabético) → grupo A
    expect(therapeuticSubgroup('empagliflozina')).toBe('Antidiabéticos (A10)')
    expect(therapeuticGroup('empagliflozina')).toBe('Digestivo y metabolismo')
  })

  it('routes herbal/homeopathic and unknowns coherently at both levels', () => {
    expect(therapeuticSubgroup('chancapiedra')).toBe('Fitoterapéutico/homeopático')
    expect(therapeuticSubgroup('')).toBe(SIN_CLASIFICAR)
    expect(therapeuticSubgroup('xyz sustancia inexistente')).toBe(SIN_CLASIFICAR)
  })
})
