// ─── Qualitative text-analysis engine ────────────────────────────────────────
// Client-side, offline-first. No external NLP API required.
// Produces term frequencies, bigrams, thematic categories and auto-generated
// epidemiological interpretations from the free-text observation field (obs).
//
// Three interpretation layers mirror the existing `buildInsights` contract:
//   • obsInsights        – corpus coverage and quality signal
//   • discourseInsights  – lexical patterns, dominant terms, negation
//   • hermeneuticInsights – thematic distribution, co-occurrence, triangulation

import type { Survey } from '../types'
import type { Insight } from './insights'

// ─── Spanish stop words ───────────────────────────────────────────────────────
// Core function words that carry no analytical signal.
const SW: Set<string> = new Set([
  // Articles / determiners
  'el','la','los','las','un','una','unos','unas','lo',
  // Prepositions
  'a','ante','bajo','con','contra','de','del','desde','durante','en',
  'entre','hacia','hasta','mediante','para','por','segun','sin','sobre',
  'tras','versus','via','al','su','sus','mi','mis','tu','tus',
  // Conjunctions
  'e','ni','o','pero','que','si','sino','u','y','aunque','porque',
  'cuando','donde','mientras','como','pues','ya','sea',
  // Pronouns
  'yo','tu','el','ella','ello','ellos','ellas','nosotros','nosotras',
  'ustedes','este','esta','estos','estas','ese','esa','esos','esas',
  'aquel','aquella','me','te','se','nos','os','le','les','uno',
  'cual','cuales','cuyo','cuya','quien','quienes',
  // High-frequency verbs (auxiliaries, copulatives, modals)
  'ser','soy','eres','es','somos','son','era','eras','eramos','eran',
  'fue','fui','fuiste','fuimos','fueron','sera','seran','sido',
  'estar','estoy','esta','estaba','estuvo','estan','estaban','estuvieron',
  'haber','ha','hay','han','habia','hubo','habian','hubieron','he','has',
  'tener','tiene','tengo','tenia','tuvo','tienen','tenian','tuvieron',
  'hacer','hace','hago','hacia','hizo','hacen','hacian','hicieron',
  'poder','puede','puedo','podia','pudo','pueden','podian','pudieron',
  'deber','debe','debia','debio','deben','debian','debieron',
  'ir','va','iba','voy','van','iban','fue','fueron',
  'decir','dice','dijo','dicen','dijeron','digo','dicho',
  'ver','ve','vio','ven','vieron','veo',
  'dar','da','dio','dan','dieron','doy',
  'saber','sabe','sabia','supo','saben','sabeo',
  'querer','quiere','queria','quiso','quieren','querian',
  // Adverbs
  'no','si','tambien','tampoco','siempre','nunca','jamas','ya','aun',
  'muy','mas','menos','tan','tanto','cuanto','ahora','antes','despues',
  'luego','entonces','asi','bien','mal','mejor','peor','aqui','alli',
  'alla','aca','todavia','solo','ademas','incluso','solo','sola',
  // Quantifiers / generic nouns that add no domain signal
  'vez','veces','tipo','caso','forma','parte','lugar','punto','mismo',
  'misma','otro','otra','todo','toda','todos','todas','cada','cualquier',
  // Short catch-alls
  'que','por','para','con','sin','mas','pero','como','bien','hay',
])

// ─── Thematic dictionary ──────────────────────────────────────────────────────
// Keywords are matched against normalised (no-accent, lowercase) observation text.
// The dictionary is domain-specific to home medication management studies.
export const THEMATIC_DICT: Record<string, string[]> = {
  'Acceso y dispensación': [
    'receta','farmacia','medico','formula','drogueria','entrega',
    'dispensacion','dispensar','prescripcion','prescrito','prescribio',
    'ordeno','consulta','consultorio','eps','cita','ordenada','formulado',
  ],
  'Conocimiento del paciente': [
    'no sabe','desconoce','confundio','confunde','leyo','indico',
    'automedicacion','automedicarse','olvido','ignora','ignoraba',
    'no conoce','no sabia','no entiende','no comprende','confusion',
    'error','equivoco','inadecuado','incorrecto','mal uso','no recuerda',
  ],
  'Conducta de almacenamiento': [
    'guardo','botiquin','cajon','nevera','acumulo','compro','sobrante',
    'almacena','almaceno','guardaba','reserva','stock','guardado',
    'acumula','sobra','sobro','quedo','quedaba','dejo','extra','exceso',
  ],
  'Calidad del dato': [
    'rechazo','nego','dudo','estimo','incompleto','aproximado',
    'negativa','no quiso','se nego','no coopero','no pudo',
    'parcial','no exacto','no hay datos','no permitio','se niega',
  ],
  'Entorno social': [
    'solo','adulto mayor','cuidador','arrendatario','familia',
    'abuelo','abuela','anciano','anciana','mayor','discapacidad',
    'limitacion','vive solo','vive sola','cuidado','barrio','zona',
    'persona mayor','tercera edad','minusvalido',
  ],
  'Señal de alarma': [
    'vencio','caduco','danado','mal olor','cambio color','abierto',
    'roto','contaminado','vencido','expirado','deteriorado','caducado',
    'mal estado','sin etiqueta','sin fecha','adulterado','sin empaque',
    'incompleto','sin prospecto','mal almacenado',
  ],
}

// ─── Exported types ───────────────────────────────────────────────────────────

export interface TermFreq  { term: string; count: number; pct: number }
export interface ThemeCount { theme: string; surveys: number; pct: number }

export interface TextAnalysisResult {
  n:         number           // total surveys in scope
  nWithObs:  number           // surveys with non-empty obs
  corpus:    string[]         // raw obs texts (trimmed, non-empty)
  topTerms:  TermFreq[]       // top 25 terms by frequency
  bigrams:   TermFreq[]       // bigrams appearing ≥ 2 times, top 12
  themes:    ThemeCount[]     // thematic categories, sorted by prevalence
  cooccurrence: {             // symmetric co-occurrence matrix (upper triangle)
    labels: string[]
    matrix: number[][]
  }
  obsInsights:          Insight[]
  discourseInsights:    Insight[]
  hermeneuticInsights:  Insight[]
}

// ─── Text normalisation ───────────────────────────────────────────────────────
// Strips diacritics, lowercases and collapses whitespace. Keep digits.
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Tokeniser ────────────────────────────────────────────────────────────────
// Returns content tokens (length > 2, not a stop word).
function tokenise(text: string): string[] {
  return norm(text)
    .split(' ')
    .filter(t => t.length > 2 && !SW.has(t))
}

// ─── Term frequency ───────────────────────────────────────────────────────────
// Operates on already-tokenised texts so the (comparatively costly) tokenisation
// is done once and shared with computeBigrams, rather than repeated per consumer.
function computeTF(tokensByText: string[][]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const tokens of tokensByText)
    for (const token of tokens)
      freq.set(token, (freq.get(token) ?? 0) + 1)
  return freq
}

// ─── Bigrams ──────────────────────────────────────────────────────────────────
// Shares the pre-tokenised corpus with computeTF (see above).
//
// Counts into a two-level map keyed by the (already-interned) token strings so
// the hot loop never allocates or re-hashes a fresh "a b" string per occurrence
// — repeated bigrams reuse the tokens' cached hashes instead. The "a b" key is
// built once per distinct bigram at the end; `order` records first appearance so
// the returned map keeps the same insertion order as a flat single-pass count.
function computeBigrams(tokensByText: string[][]): Map<string, number> {
  const counts = new Map<string, Map<string, number>>()
  const order: [string, string][] = []
  for (const tokens of tokensByText) {
    for (let i = 1; i < tokens.length; i++) {
      const a = tokens[i - 1], b = tokens[i]
      let inner = counts.get(a)
      if (inner === undefined) counts.set(a, (inner = new Map()))
      const c = inner.get(b)
      if (c === undefined) { inner.set(b, 1); order.push([a, b]) }
      else inner.set(b, c + 1)
    }
  }
  const freq = new Map<string, number>()
  for (const [a, b] of order) freq.set(`${a} ${b}`, counts.get(a)!.get(b)!)
  return freq
}

// ─── Theme detection ──────────────────────────────────────────────────────────
// Returns all theme names whose keyword list has at least one match in `text`.
function detectThemes(text: string): string[] {
  const n = norm(text)
  return Object.entries(THEMATIC_DICT)
    .filter(([, kws]) => kws.some(kw => n.includes(kw)))
    .map(([theme]) => theme)
}

// ─── Negation bigrams ─────────────────────────────────────────────────────────
const NEG = new Set(['no','nunca','tampoco','sin','jamas','ni'])

function negationExamples(texts: string[]): string[] {
  const found = new Set<string>()
  for (const text of texts) {
    const raw = text.toLowerCase().split(/\s+/)
    for (let i = 0; i < raw.length - 1 && found.size < 3; i++) {
      const w = raw[i].replace(/[^a-záéíóúüñ]/gi, '')
      if (NEG.has(norm(w))) {
        const next = raw[i + 1].replace(/[^a-záéíóúüñ]/gi, '')
        if (next.length > 1) found.add(`${w} ${next}`)
      }
    }
  }
  return Array.from(found)
}

// ─── Insight builders ─────────────────────────────────────────────────────────

function buildObsInsights(nWithObs: number, n: number): Insight[] {
  if (nWithObs === 0) return [{
    id: 'obs-none', tone: 'warn',
    text: 'Ninguna encuesta del conjunto incluye observaciones de campo. El análisis de texto no puede ejecutarse. Incentiva a los encuestadores a registrar observaciones en el Paso 6 del formulario.',
  }]

  const pct  = n > 0 ? nWithObs / n : 0
  const pStr = (pct * 100).toFixed(1).replace('.', ',')
  if (pct < 0.20) return [{
    id: 'obs-low', tone: 'warn',
    text: `Cobertura de observaciones baja (${pStr}%, n=${nWithObs}/${n}). El corpus es pequeño — los patrones de texto son pistas, no hallazgos representativos. Los análisis discursivo y hermenéutico deben interpretarse como exploración preliminar.`,
  }]
  if (pct < 0.60) return [{
    id: 'obs-mid', tone: 'info',
    text: `Cobertura de observaciones moderada (${pStr}%, n=${nWithObs}/${n}). Los patrones identificados son orientadores — triangula con los indicadores cuantitativos antes de derivar conclusiones.`,
  }]
  return [{
    id: 'obs-high', tone: 'good',
    text: `Cobertura de observaciones alta (${pStr}%, n=${nWithObs}/${n}): base cualitativa sólida para el análisis discursivo y hermenéutico.`,
  }]
}

function buildDiscourseInsights(
  topTerms: TermFreq[],
  bigrams:  TermFreq[],
  corpus:   string[],
  nWithObs: number,
): Insight[] {
  const out: Insight[] = []
  if (topTerms.length === 0) return out

  const totalOcc = topTerms.reduce((a, t) => a + t.count, 0)
  const top1 = topTerms[0]
  const top1Pct = totalOcc > 0 ? (top1.count / totalOcc * 100) : 0

  // Lexical dominance
  if (top1Pct > 25) {
    out.push({
      id: 'disc-dom', tone: 'warn',
      text: `Dominancia léxica marcada: el término "${top1.term}" concentra el ${top1Pct.toFixed(0)}% de las ocurrencias. Puede indicar sesgo de reporte, terminología inducida por el instrumento o un tema emergente que merece exploración cuantitativa (e.g., crear una sub-escala o variable específica).`,
    })
  } else {
    out.push({
      id: 'disc-div', tone: 'good',
      text: `Vocabulario diversificado: el término más frecuente ("${top1.term}") representa solo el ${top1Pct.toFixed(0)}% de las ocurrencias. El corpus refleja múltiples dimensiones del campo — favorable para un análisis hermenéutico rico.`,
    })
  }

  // Negation patterns
  const negEx = negationExamples(corpus)
  if (negEx.length > 0) {
    const sample = negEx.slice(0, 2).map(b => `"${b}"`).join(', ')
    out.push({
      id: 'disc-neg', tone: 'info',
      text: `Patrones de negación detectados en el corpus (p. ej., ${sample}). En epidemiología cualitativa, la negación suele marcar barreras de acceso, ausencia de conocimiento o rechazo de prácticas — fenómenos que el instrumento cuantitativo puede no capturar con precisión.`,
    })
  }

  // Bigram signal
  if (bigrams.length >= 3) {
    const topBg = bigrams[0]
    out.push({
      id: 'disc-bg', tone: 'info',
      text: `Bigrama más frecuente: "${topBg.term}" (${topBg.count} veces). Los bigramas revelan frases-clave que los términos aislados no detectan. Úsalos para afinar las categorías de codificación o diseñar ítems nuevos en versiones futuras del instrumento.`,
    })
  }

  // Corpus size caveat
  if (nWithObs < 15) {
    out.push({
      id: 'disc-size', tone: 'warn',
      text: `Corpus pequeño (n=${nWithObs} observaciones): las frecuencias de términos son inestables y sensibles a observaciones individuales. Interpreta los patrones como señales para exploración cualitativa profunda (entrevistas, grupos focales), no como hallazgos consolidados.`,
    })
  }

  return out
}

function buildHermeneuticInsights(
  themes:      ThemeCount[],
  _nWithObs:   number,
  coMatrix:    number[][],
  themeLabels: string[],
): Insight[] {
  const out: Insight[] = []

  if (themes.length === 0) {
    out.push({
      id: 'herm-none', tone: 'info',
      text: 'Ninguna observación activó categorías del diccionario temático. Considera ampliar el diccionario de palabras clave (especialmente con jerga local) o verificar que las observaciones contengan texto descriptivo más allá de respuestas cortas.',
    })
    return out
  }

  const top = themes[0]
  const topPct = (top.pct * 100).toFixed(0)

  // Dominant theme
  if (top.pct > 0.5) {
    out.push({
      id: 'herm-dom', tone: 'warn',
      text: `El tema "${top.theme}" domina el análisis hermenéutico (${topPct}% de observaciones). Verifica si el instrumento, la pauta de capacitación o el contexto de campo está dirigiendo las observaciones hacia este tema — una concentración tan alta puede señalar sesgo de reporte o una realidad epidemiológica especialmente relevante que merece triangulación.`,
    })
  } else {
    out.push({
      id: 'herm-bal', tone: 'info',
      text: `El tema más frecuente es "${top.theme}" (${topPct}% de observaciones). La distribución temática es el mapa de los fenómenos que los encuestadores percibieron como relevantes — debe leerse como evidencia de campo complementaria, no sustituta, del análisis cuantitativo.`,
    })
  }

  // Data quality threshold
  const qcTheme = themes.find(t => t.theme === 'Calidad del dato')
  if (qcTheme && qcTheme.pct > 0.15) {
    out.push({
      id: 'herm-qc', tone: 'warn',
      text: `El ${(qcTheme.pct * 100).toFixed(0)}% de observaciones contiene señales de calidad del dato comprometida (umbral metodológico sugerido: 15%). Considera auditar estos registros antes del análisis confirmatorio — pueden introducir sesgo de información si se procesan sin corrección.`,
    })
  }

  // Alarm signals
  const alarmTheme = themes.find(t => t.theme === 'Señal de alarma')
  if (alarmTheme && alarmTheme.surveys > 0) {
    out.push({
      id: 'herm-alarm', tone: 'warn',
      text: `Se detectaron ${alarmTheme.surveys} observación(es) con señales de alarma sanitaria. Verifica si estos hogares corresponden a los que reportan medicamentos vencidos confirmados en el análisis cuantitativo — la triangulación puede revelar riesgo real no capturado completamente por las variables estructuradas del instrumento.`,
    })
  }

  // Top co-occurrence pair
  let maxCooc = 0; let maxI = -1; let maxJ = -1
  for (let i = 0; i < coMatrix.length; i++)
    for (let j = i + 1; j < (coMatrix[i]?.length ?? 0); j++)
      if ((coMatrix[i]?.[j] ?? 0) > maxCooc) { maxCooc = coMatrix[i][j]; maxI = i; maxJ = j }

  if (maxCooc >= 3 && maxI >= 0 && maxJ >= 0) {
    out.push({
      id: 'herm-cooc', tone: 'info',
      text: `La co-ocurrencia más frecuente es "${themeLabels[maxI]}" + "${themeLabels[maxJ]}" (${maxCooc} encuestas). Esta díada temática puede señalar una relación entre fenómenos — hipótesis candidata para la siguiente fase del estudio (p.e., análisis de mediación o instrumento ampliado).`,
    })
  }

  // Methodological caveat — always show
  out.push({
    id: 'herm-method', tone: 'info',
    text: 'Nota hermenéutica: la categorización temática es automática (basada en diccionario de palabras clave), no en codificación manual. Para un análisis hermenéutico riguroso, valida estas categorías mediante lectura directa del corpus y triangulación con informantes clave del equipo de campo.',
  })

  return out
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function buildTextAnalysis(surveys: Survey[]): TextAnalysisResult | null {
  const withObs = surveys.filter(s => s.obs?.trim())
  const nWithObs = withObs.length
  const n = surveys.length

  if (nWithObs === 0) return {
    n, nWithObs, corpus: [], topTerms: [], bigrams: [], themes: [],
    cooccurrence: { labels: [], matrix: [] },
    obsInsights: buildObsInsights(0, n),
    discourseInsights: [],
    hermeneuticInsights: [],
  }

  const corpus = withObs.map(s => s.obs.trim())

  // Tokenise the corpus once and reuse it for both term-frequency and bigram
  // computation, which would otherwise each re-tokenise every observation.
  const tokensByText = corpus.map(tokenise)

  // Term frequency
  const tfMap = computeTF(tokensByText)
  const sortedTerms = Array.from(tfMap.entries()).sort((a, b) => b[1] - a[1])
  const totalOcc = sortedTerms.reduce((a, [, c]) => a + c, 0)
  const topTerms: TermFreq[] = sortedTerms
    .slice(0, 25)
    .map(([term, count]) => ({ term, count, pct: totalOcc > 0 ? count / totalOcc : 0 }))

  // Bigrams (min frequency 2)
  const bgMap = computeBigrams(tokensByText)
  const bigrams: TermFreq[] = Array.from(bgMap.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count, pct: totalOcc > 0 ? count / totalOcc : 0 }))

  // Theme detection per survey (count each theme at most once per survey)
  const surveyThemes = withObs.map(s => [...new Set(detectThemes(s.obs))])

  const themeMap: Record<string, number> = {}
  for (const st of surveyThemes)
    for (const theme of st)
      themeMap[theme] = (themeMap[theme] ?? 0) + 1

  const themes: ThemeCount[] = Object.entries(themeMap)
    .map(([theme, surveys]) => ({ theme, surveys, pct: surveys / nWithObs }))
    .sort((a, b) => b.surveys - a.surveys)

  // Co-occurrence matrix (symmetric, zero diagonal)
  const themeLabels = themes.map(t => t.theme)
  const themeIndex = new Map(themeLabels.map((t, i) => [t, i]))
  const matrix: number[][] = themeLabels.map(() => new Array(themeLabels.length).fill(0))
  // Single pass over surveys: increment each theme pair present in a survey
  for (const st of surveyThemes) {
    const idx = st.map(t => themeIndex.get(t)!)
    for (let a = 0; a < idx.length; a++)
      for (let b = a + 1; b < idx.length; b++) {
        matrix[idx[a]][idx[b]]++
        matrix[idx[b]][idx[a]]++
      }
  }

  return {
    n, nWithObs, corpus, topTerms, bigrams, themes,
    cooccurrence: { labels: themeLabels, matrix },
    obsInsights:         buildObsInsights(nWithObs, n),
    discourseInsights:   buildDiscourseInsights(topTerms, bigrams, corpus, nWithObs),
    hermeneuticInsights: buildHermeneuticInsights(themes, nWithObs, matrix, themeLabels),
  }
}
