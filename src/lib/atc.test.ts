import { describe, it, expect } from 'vitest'
import { therapeuticGroup, therapeuticSubgroup, normalizeDci, canonical, SIN_CLASIFICAR } from './atc'
import { ATC_LEVEL2_BY_INGREDIENT } from './atc-cum.data'

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

  it('classifies the expanded curated set (levels 1 and 2 stay consistent)', () => {
    const cases: Array<[string, string, string]> = [
      ['losartan', 'IECA / ARA-II (C09)', 'Cardiovascular'],
      ['atenolol', 'Betabloqueantes (C07)', 'Cardiovascular'],
      ['simvastatina', 'Hipolipemiantes (C10)', 'Cardiovascular'],
      ['digoxina', 'Terapia cardíaca (C01)', 'Cardiovascular'],
      ['rivaroxaban', 'Antitrombóticos (B01)', 'Sangre'],
      ['escitalopram', 'Psicoanalépticos (N06)', 'Sistema nervioso'],
      ['diazepam', 'Psicolépticos (N05)', 'Sistema nervioso'],
      ['carbamazepina', 'Antiepilépticos (N03)', 'Sistema nervioso'],
      ['acido valproico', 'Antiepilépticos (N03)', 'Sistema nervioso'],
      ['metocarbamol', 'Relajantes musculares (M03)', 'Musculoesquelético'],
      ['alopurinol', 'Antigotosos (M04)', 'Musculoesquelético'],
      ['alendronato de sodio', 'Óseo / bifosfonatos (M05)', 'Musculoesquelético'],
      ['rifampicina', 'Antimicobacterianos (J04)', 'Antiinfecciosos'],
      // ketoconazol: el CUM lo clasifica mayoritariamente tópico (D01) — en
      // Colombia predominan shampoo/crema — no el sistémico J02. Valor sourced.
      ['ketoconazol', 'Antifúngicos tópicos (D01)', 'Dermatológicos'],
      ['tinidazol', 'Antiprotozoarios (P01)', 'Antiparasitarios'],
      ['tamoxifeno', 'Terapia endocrina oncológica (L02)', 'Antineoplásicos e inmunomoduladores'],
      ['metotrexato', 'Inmunosupresores (L04)', 'Antineoplásicos e inmunomoduladores'],
      ['latanoprost', 'Oftalmológicos (S01)', 'Órganos de los sentidos'],
      ['naloxona', 'Otros productos terapéuticos (V03)', 'Varios'],
      ['etinilestradiol', 'Hormonas sexuales (G03)', 'Genitourinario'],
      ['metformina', 'Antidiabéticos (A10)', 'Digestivo y metabolismo'],
      ['ondansetron', 'Antieméticos (A04)', 'Digestivo y metabolismo'],
    ]
    for (const [dci, sub, group] of cases) {
      expect(therapeuticSubgroup(dci)).toBe(sub)
      expect(therapeuticGroup(dci)).toBe(group)
    }
  })

  it('does not misclassify tinidazol/secnidazol as the J01 metronidazol rule', () => {
    // Distinct nitroimidazoles must not be swallowed by the earlier J01 rule.
    expect(therapeuticGroup('tinidazol 500 mg')).toBe('Antiparasitarios')
  })
})

describe('CUM-sourced dictionary (provenance)', () => {
  it('loads a non-trivial verifiable lookup from the CUM export', () => {
    expect(Object.keys(ATC_LEVEL2_BY_INGREDIENT).length).toBeGreaterThan(2000)
    // Todas las entradas son códigos de subgrupo ATC nivel 2 (letra + 2 dígitos).
    for (const code of Object.values(ATC_LEVEL2_BY_INGREDIENT)) {
      expect(code).toMatch(/^[A-Z]\d{2}$/)
    }
  })

  it('canonical() extracts the active ingredient from noisy CUM/DCI text', () => {
    expect(canonical('AMOXICILINA TRIHIDRATO (1048.97) EQUIVALENTE A AMOXICILINA')).toBe('amoxicilina')
    expect(canonical('SALBUTAMOL SULFATO (100 MCG DE SALBUTAMOL/DOSIS)')).toBe('salbutamol')
    expect(canonical('losartan 50 mg potasico')).toBe('losartan')
  })
})

// Regresión sobre DCI REALES del piloto (texto libre ruidoso tal como lo teclean
// los encuestadores). Confirma que el pipeline sourced clasifica el dato real.
describe('classifies real pilot DCIs (noisy free text)', () => {
  const cases: Array<[string, string]> = [
    ['AMOXICILINA TRIHIDRATO (1048.97) EQUIVALENTE A AMOXICILINA', 'Antiinfecciosos'],
    ['SALBUTAMOL SULFATO (100 MCG DE SALBUTAMOL/DOSIS)', 'Respiratorio'],
    ['losartan 50 mg potasico', 'Cardiovascular'],
    ['HIDROCLOROTIAZIDA', 'Cardiovascular'],          // C03, no el combo C09
    ['AMLODIPINO BESILATO 13.87 MGEQUIVALENTE A AMLODIPINO BASE', 'Cardiovascular'],
    ['ACETAMINOFEN, FENILEFRINA, CLORFENIRAMINA', 'Respiratorio'], // combo → componente reconocido
    ['CALAMINA (OXIDO DE ZINC: 5G + ARIABEL SIENNA: 0.02G)', 'Dermatológicos'], // override
    ['ÁCIDO ACETILSALICÍLICO', 'Sistema nervioso'],   // override N02
    ['CAFEINA', 'Sistema nervioso'],                  // override N06 (no M01 de combos)
    ['1.5 G DE CARBONATO DE CALCIO EQUIVALENTE A CALCIO', 'Digestivo y metabolismo'], // override A12
    ['Complejo b', 'Digestivo y metabolismo'],        // override A11
    ['METRONIDAZOL Y NIFUROXAZIDA', 'Antiparasitarios'],
    ['Chancapiedra', 'Fitoterapéutico/homeopático'],
    ['Homeopatico complejo', 'Fitoterapéutico/homeopático'],
    ['VITACERVIN-A', SIN_CLASIFICAR],                 // marca sin DCI → no se adivina
  ]
  it('maps each to the expected anatomical group', () => {
    for (const [dci, group] of cases) expect(therapeuticGroup(dci)).toBe(group)
  })
})

describe('matchCode memoization is transparent', () => {
  it('repeated and cross-function calls on the same DCI stay consistent', () => {
    // Both functions share the memoized matchCode; a cached hit (including a
    // cached "unknown" null) must yield the same result as the first call.
    for (const dci of ['acetaminofen', 'acetaminofen', 'losartan 50 mg potasico',
                        'xyz sustancia inexistente', 'xyz sustancia inexistente', '']) {
      expect(therapeuticGroup(dci)).toBe(therapeuticGroup(dci))
      expect(therapeuticSubgroup(dci)).toBe(therapeuticSubgroup(dci))
    }
    // A normalized variant resolves to the same class as its canonical form.
    expect(therapeuticSubgroup('  ACETAMINOFÉN  ')).toBe(therapeuticSubgroup('acetaminofen'))
  })
})
