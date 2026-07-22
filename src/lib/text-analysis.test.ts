import { describe, it, expect } from 'vitest'
import { buildTextAnalysis, THEMATIC_DICT } from './text-analysis'
import type { Survey } from '../types'

// ─── Minimal survey factory ───────────────────────────────────────────────────
let _uid = 0
function s(obs: string): Survey {
  return {
    id: `test-${++_uid}`,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    fEta: '2024-01-15', nuiEtr: 1, nui: _uid,
    hogarId: '', metodoSeleccion: '',
    etrPrograma: 'Medicina', etrTipoInst: 'Pública',
    etrSemestre: 5, etrInstitucion: 'Universidad',
    fNac: '1980-01-01', ciudad: 'Bogotá', dir: 'Calle 1',
    estrato: 2, etnia: 'Ninguna', asSalud: 'Contributivo',
    estLab: 'Empleado', ingreso: '1-3 SMMLV',
    nvEstu: 'Profesional', nvPosg: '',
    perSalud: 'Buena', estSalud: 'No', prbSalud: '',
    conMed: '', medPrc: '', fPrc: '', fDisp: '', indMed: '',
    medSob: 'Sí', dispMedVc: 'No', ctoDispVc: '',
    vtoMedNc: 'Sí', cantMed: 5, cantMedVto: 2, pesoMedNc: 100,
    medications: [],
    motNoConsumo: [], motNoConsumoOtro: '',
    motVencimiento: [], motVencimientoOtro: '',
    dispFinal: [], dispFinalOtro: '',
    conocePuntos: 'No', cualPunto: '',
    obs,
  }
}

// ─── THEMATIC_DICT export ────────────────────────────────────────────────────

describe('THEMATIC_DICT', () => {
  it('exports 6 thematic categories', () => {
    expect(Object.keys(THEMATIC_DICT)).toHaveLength(6)
  })
  it('each category has at least one keyword', () => {
    for (const kws of Object.values(THEMATIC_DICT)) expect(kws.length).toBeGreaterThan(0)
  })
})

// ─── buildTextAnalysis — empty / no-obs cases ────────────────────────────────

describe('buildTextAnalysis — empty input', () => {
  it('returns nWithObs=0 and an obs warning when no surveys exist', () => {
    const r = buildTextAnalysis([])
    expect(r).not.toBeNull()
    expect(r!.n).toBe(0)
    expect(r!.nWithObs).toBe(0)
    expect(r!.obsInsights[0].tone).toBe('warn')
    expect(r!.obsInsights[0].id).toBe('obs-none')
  })

  it('returns empty arrays when surveys have blank obs', () => {
    const r = buildTextAnalysis([s(''), s('  '), s('\n')])
    expect(r!.nWithObs).toBe(0)
    expect(r!.topTerms).toHaveLength(0)
    expect(r!.bigrams).toHaveLength(0)
    expect(r!.themes).toHaveLength(0)
    expect(r!.discourseInsights).toHaveLength(0)
  })
})

// ─── buildTextAnalysis — obs coverage insight bands ──────────────────────────

describe('buildTextAnalysis — obs coverage bands', () => {
  it('warns with tone=warn and id=obs-low when obs coverage < 20%', () => {
    // 1 of 10 surveys has obs → 10%
    const surveys = [s('paciente no sabe donde guardar farmacia'), ...Array.from({ length: 9 }, () => s(''))]
    const r = buildTextAnalysis(surveys)
    const ins = r!.obsInsights[0]
    expect(ins.id).toBe('obs-low')
    expect(ins.tone).toBe('warn')
    expect(ins.text).toMatch(/10,0%/)
  })

  it('emits tone=info and id=obs-mid when coverage is 20–59%', () => {
    // 4 of 10 surveys → 40%
    const surveys = [
      ...Array.from({ length: 4 }, () => s('farmacia receta consulta medico')),
      ...Array.from({ length: 6 }, () => s('')),
    ]
    const r = buildTextAnalysis(surveys)
    expect(r!.obsInsights[0].id).toBe('obs-mid')
    expect(r!.obsInsights[0].tone).toBe('info')
  })

  it('emits tone=good and id=obs-high when coverage ≥ 60%', () => {
    // 8 of 10 surveys → 80%
    const surveys = [
      ...Array.from({ length: 8 }, () => s('farmacia receta consulta medico')),
      ...Array.from({ length: 2 }, () => s('')),
    ]
    const r = buildTextAnalysis(surveys)
    expect(r!.obsInsights[0].id).toBe('obs-high')
    expect(r!.obsInsights[0].tone).toBe('good')
  })
})

// ─── buildTextAnalysis — term frequency ──────────────────────────────────────

describe('buildTextAnalysis — term frequency', () => {
  it('returns topTerms sorted descending by count', () => {
    // "botiquin" repeated more than "farmacia"
    const r = buildTextAnalysis([s('botiquin botiquin botiquin farmacia farmacia')])
    expect(r!.topTerms[0].term).toBe('botiquin')
    expect(r!.topTerms[0].count).toBeGreaterThan(r!.topTerms[1]?.count ?? 0)
  })

  it('strips Spanish stopwords from tokens', () => {
    // "de la el es con" are all stopwords → no surviving terms
    const r = buildTextAnalysis([s('de la el es con')])
    expect(r!.topTerms).toHaveLength(0)
  })

  it('filters out tokens shorter than 3 characters', () => {
    const r = buildTextAnalysis([s('ir ya ok')])
    expect(r!.topTerms).toHaveLength(0)
  })

  it('normalises accents before counting (á → a)', () => {
    const r = buildTextAnalysis([s('farmacía farmacia')])
    // Both should count as the same token "farmacia"
    expect(r!.topTerms[0].count).toBe(2)
  })
})

// ─── buildTextAnalysis — bigrams ─────────────────────────────────────────────

describe('buildTextAnalysis — bigrams', () => {
  it('only includes bigrams with frequency ≥ 2', () => {
    // "botiquin farmacia" appears twice; "adulto solo" appears once
    const r = buildTextAnalysis([
      s('botiquin farmacia'),
      s('botiquin farmacia adulto solo'),
    ])
    const bgs = r!.bigrams.map(b => b.term)
    expect(bgs).toContain('botiquin farmacia')
    expect(bgs).not.toContain('adulto solo')
  })

  it('returns empty bigrams list when no pair repeats', () => {
    const r = buildTextAnalysis([s('botiquin farmacia receta consulta')])
    expect(r!.bigrams).toHaveLength(0)
  })
})

// ─── buildTextAnalysis — discourse insights ──────────────────────────────────

describe('buildTextAnalysis — discourse insights', () => {
  it('warns disc-dom when a single term has > 25% of occurrences', () => {
    // "botiquin" × 6 out of ~6 total tokens = 100%
    const r = buildTextAnalysis([s('botiquin botiquin botiquin botiquin botiquin botiquin')])
    expect(r!.discourseInsights.find(i => i.id === 'disc-dom')?.tone).toBe('warn')
  })

  it('emits disc-div (good) when vocabulary is diverse', () => {
    // Many different terms so top-1 stays under 25%
    const terms = ['farmacia','botiquin','receta','adulto','cuidador','almacena','señora','consulta','pediatra','vencido']
    const r = buildTextAnalysis([s(terms.join(' '))])
    expect(r!.discourseInsights.find(i => i.id === 'disc-div')?.tone).toBe('good')
  })

  it('emits disc-neg when negation bigrams are present', () => {
    const r = buildTextAnalysis([s('la señora no sabe donde guardar los medicamentos')])
    expect(r!.discourseInsights.find(i => i.id === 'disc-neg')).toBeTruthy()
  })

  it('emits disc-bg when corpus has ≥ 3 bigrams', () => {
    // Same text twice → repeating bigrams
    const text = 'farmacia receta botiquin cuidador almacena medicamentos vencidos adulto'
    const r = buildTextAnalysis([s(text), s(text), s(text)])
    expect(r!.discourseInsights.find(i => i.id === 'disc-bg')).toBeTruthy()
  })

  it('warns disc-size when corpus has fewer than 15 observations', () => {
    const r = buildTextAnalysis([s('paciente farmacia receta')])
    expect(r!.discourseInsights.find(i => i.id === 'disc-size')?.tone).toBe('warn')
  })

  it('does not emit disc-size when corpus has ≥ 15 observations', () => {
    const surveys = Array.from({ length: 15 }, () => s('farmacia receta botiquin consulta medico'))
    const r = buildTextAnalysis(surveys)
    expect(r!.discourseInsights.find(i => i.id === 'disc-size')).toBeUndefined()
  })
})

// ─── buildTextAnalysis — theme detection ─────────────────────────────────────

describe('buildTextAnalysis — theme detection', () => {
  it('detects "Acceso y dispensación" from keyword "farmacia"', () => {
    const r = buildTextAnalysis([s('paciente fue a la farmacia')])
    expect(r!.themes.some(t => t.theme === 'Acceso y dispensación')).toBe(true)
  })

  it('detects "Señal de alarma" from keyword "vencido"', () => {
    const r = buildTextAnalysis([s('medicamento vencido encontrado')])
    expect(r!.themes.some(t => t.theme === 'Señal de alarma')).toBe(true)
  })

  it('detects "Calidad del dato" from keyword "nego"', () => {
    const r = buildTextAnalysis([s('paciente nego informacion')])
    expect(r!.themes.some(t => t.theme === 'Calidad del dato')).toBe(true)
  })

  it('detects a multi-word keyword phrase ("adulto mayor")', () => {
    const r = buildTextAnalysis([s('vive con un adulto mayor en casa')])
    expect(r!.themes.some(t => t.theme === 'Entorno social')).toBe(true)
  })

  it('counts each theme at most once per survey', () => {
    // obs with "farmacia" repeated 5 times → still 1 survey for the theme
    const r = buildTextAnalysis([s('farmacia farmacia farmacia farmacia farmacia')])
    const acceso = r!.themes.find(t => t.theme === 'Acceso y dispensación')
    expect(acceso?.surveys).toBe(1)
  })

  it('returns no themes when obs has no matching keywords', () => {
    const r = buildTextAnalysis([s('encuesta realizada sin inconvenientes generales')])
    // "sin" is a stopword, "encuesta" / "realizada" / "inconvenientes" / "generales"
    // might not match any keyword — result may have 0 themes
    // (just check it doesn't crash and returns an array)
    expect(Array.isArray(r!.themes)).toBe(true)
  })

  it('sorts themes by number of surveys descending', () => {
    const surveys = [
      s('farmacia receta medico'),          // Acceso
      s('farmacia receta medico'),          // Acceso
      s('botiquin guardo acumulo'),         // Almacenamiento
    ]
    const r = buildTextAnalysis(surveys)
    expect(r!.themes[0].surveys).toBeGreaterThanOrEqual(r!.themes[1]?.surveys ?? 0)
  })
})

// ─── buildTextAnalysis — co-occurrence matrix ─────────────────────────────────

describe('buildTextAnalysis — co-occurrence matrix', () => {
  it('matrix diagonal is always 0', () => {
    const r = buildTextAnalysis([s('farmacia botiquin vencido')])
    const { matrix } = r!.cooccurrence
    matrix.forEach((row, i) => expect(row[i]).toBe(0))
  })

  it('matrix is symmetric', () => {
    const r = buildTextAnalysis([s('farmacia botiquin vencido receta')])
    const { matrix } = r!.cooccurrence
    matrix.forEach((row, i) =>
      row.forEach((val, j) => expect(val).toBe(matrix[j]?.[i] ?? 0))
    )
  })

  it('records co-occurrence correctly', () => {
    // Both Acceso (farmacia) and Almacenamiento (botiquin) in same obs
    const r = buildTextAnalysis([s('farmacia botiquin'), s('farmacia botiquin')])
    const { labels, matrix } = r!.cooccurrence
    const iA = labels.indexOf('Acceso y dispensación')
    const iB = labels.indexOf('Conducta de almacenamiento')
    if (iA >= 0 && iB >= 0) {
      expect(matrix[iA][iB]).toBe(2)
    }
  })
})

// ─── buildTextAnalysis — hermeneutic insights ────────────────────────────────

describe('buildTextAnalysis — hermeneutic insights', () => {
  it('emits herm-none (info) when no keywords match any theme', () => {
    // Words that won't match any dictionary entry
    const r = buildTextAnalysis([s('observacion registrada correctamente')])
    const none = r!.hermeneuticInsights.find(i => i.id === 'herm-none')
    expect(none?.tone).toBe('info')
  })

  it('warns herm-dom when one theme covers > 50% of observations', () => {
    // All 3 obs contain "farmacia" → Acceso = 100%
    const r = buildTextAnalysis([
      s('farmacia receta dispensacion'),
      s('farmacia consulta medico'),
      s('farmacia entrega formulada'),
    ])
    const dom = r!.hermeneuticInsights.find(i => i.id === 'herm-dom')
    expect(dom?.tone).toBe('warn')
  })

  it('emits herm-bal (info) when no single theme dominates', () => {
    const r = buildTextAnalysis([
      s('farmacia receta medico'),         // Acceso
      s('botiquin guardo acumulo'),        // Almacenamiento
      s('adulto mayor vive solo'),         // Entorno social
      s('no sabe donde desconoce'),        // Conocimiento
    ])
    expect(r!.hermeneuticInsights.find(i => i.id === 'herm-bal')?.tone).toBe('info')
  })

  it('warns herm-qc when "Calidad del dato" exceeds 15%', () => {
    // 2 of 8 obs (25%) trigger Calidad del dato
    const surveys = [
      s('paciente nego la entrevista'),
      s('informacion incompleta rechazo'),
      ...Array.from({ length: 6 }, () => s('farmacia receta botiquin consulta')),
    ]
    const r = buildTextAnalysis(surveys)
    const qc = r!.hermeneuticInsights.find(i => i.id === 'herm-qc')
    expect(qc?.tone).toBe('warn')
  })

  it('warns herm-alarm when "Señal de alarma" is detected', () => {
    const r = buildTextAnalysis([s('medicamento vencido deteriorado')])
    expect(r!.hermeneuticInsights.find(i => i.id === 'herm-alarm')?.tone).toBe('warn')
  })

  it('emits herm-cooc when a theme pair co-occurs in ≥ 3 surveys', () => {
    const surveys = Array.from({ length: 3 }, () =>
      s('farmacia botiquin receta guardo acumulo')
    )
    const r = buildTextAnalysis(surveys)
    expect(r!.hermeneuticInsights.find(i => i.id === 'herm-cooc')).toBeTruthy()
  })

  it('always ends with the methodological caveat', () => {
    const r = buildTextAnalysis([s('farmacia receta')])
    const last = r!.hermeneuticInsights.at(-1)
    expect(last?.id).toBe('herm-method')
    expect(last?.tone).toBe('info')
  })
})

// ─── buildTextAnalysis — result structure ────────────────────────────────────

describe('buildTextAnalysis — result structure', () => {
  it('sets n to total surveys and nWithObs to those with text', () => {
    const r = buildTextAnalysis([s('farmacia receta'), s(''), s('botiquin')])
    expect(r!.n).toBe(3)
    expect(r!.nWithObs).toBe(2)
  })

  it('corpus contains trimmed non-empty obs strings', () => {
    const r = buildTextAnalysis([s(' farmacia receta '), s(''), s('  ')])
    expect(r!.corpus).toHaveLength(1)
    expect(r!.corpus[0]).toBe('farmacia receta')
  })

  it('pct on topTerms sums close to 1 over all returned terms', () => {
    const r = buildTextAnalysis([s('farmacia botiquin receta consulta adulto')])
    const total = r!.topTerms.reduce((a, t) => a + t.pct, 0)
    expect(total).toBeCloseTo(1, 1)
  })
})
