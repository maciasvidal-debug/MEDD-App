// =====================================================================
// Clasificación terapéutica (ATC) de medicamentos — niveles 1 y 2.
//
// Mapea el principio activo (DCI, texto libre y con ruido: sufijos de sal,
// "equivalente a…", concentraciones, combinaciones) a su código ATC nivel 2
// (subgrupo terapéutico, p. ej. J01 antibacterianos, C09 IECA/ARA-II). De ese
// código se derivan AMBOS niveles: el nivel 1 (grupo anatómico) es la primera
// letra del código. Una sola tabla fuente evita que niveles 1 y 2 se
// desincronicen.
//
// Es determinista y referencialmente transparente (misma entrada → misma
// salida, sin efectos observables): segura, idempotente y trivial de testear.
// Internamente memoiza el emparejamiento por DCI (detalle de implementación que
// no cambia esos resultados).
//
// Estrategia: normalizar (minúsculas, sin tildes, espacios) y buscar la primera
// RAÍZ de principio activo como subcadena. Las reglas están ORDENADAS: combos
// gripales/antihistamínicos y tokens específicos antes que los tokens amplios
// del grupo A (calcio, zinc, vitaminas), de modo que p. ej. "calamina (óxido de
// zinc…)" cae en Dermatológicos y no en Digestivo. Las combinaciones se
// clasifican por el primer componente reconocido; los desconocidos devuelven
// SIN_CLASIFICAR (reportado como % de cobertura para no sobre-interpretar).
// =====================================================================

export const SIN_CLASIFICAR = 'Sin clasificar'

const FITO = 'FITO' // centinela: fitoterapéutico/homeopático (fuera de ATC)

// Nivel 1 — grupo anatómico por letra ATC (+ bucket no-ATC para fitoterapia).
const GROUP_LABELS: Record<string, string> = {
  A: 'Digestivo y metabolismo',
  B: 'Sangre',
  C: 'Cardiovascular',
  D: 'Dermatológicos',
  G: 'Genitourinario',
  H: 'Hormonales sistémicos',
  J: 'Antiinfecciosos',
  M: 'Musculoesquelético',
  N: 'Sistema nervioso',
  P: 'Antiparasitarios',
  R: 'Respiratorio',
  S: 'Órganos de los sentidos',
  [FITO]: 'Fitoterapéutico/homeopático',
}

// Nivel 2 — etiqueta legible por código ATC.
const SUBGROUP_LABELS: Record<string, string> = {
  A02: 'Antiácidos / antiulcerosos (A02)',
  A03: 'Antiespasmódicos (A03)',
  A06: 'Laxantes (A06)',
  A07: 'Antidiarreicos / probióticos (A07)',
  A10: 'Antidiabéticos (A10)',
  A11: 'Vitaminas (A11)',
  A12: 'Minerales (A12)',
  B01: 'Antitrombóticos (B01)',
  B02: 'Antihemorrágicos (B02)',
  B03: 'Antianémicos (B03)',
  C03: 'Diuréticos (C03)',
  C05: 'Vasoprotectores (C05)',
  C07: 'Betabloqueantes (C07)',
  C08: 'Calcioantagonistas (C08)',
  C09: 'IECA / ARA-II (C09)',
  C10: 'Hipolipemiantes (C10)',
  D01: 'Antifúngicos tópicos (D01)',
  D02: 'Emolientes / protectores (D02)',
  D06: 'Antibióticos tópicos (D06)',
  D07: 'Corticoides tópicos (D07)',
  D08: 'Antisépticos (D08)',
  D10: 'Antiacné (D10)',
  G04: 'Urológicos (G04)',
  H02: 'Corticoides sistémicos (H02)',
  H03: 'Terapia tiroidea (H03)',
  J01: 'Antibacterianos (J01)',
  J02: 'Antimicóticos (J02)',
  J05: 'Antivirales (J05)',
  M01: 'AINE / antirreumáticos (M01)',
  N02: 'Analgésicos (N02)',
  N03: 'Antiepilépticos (N03)',
  N05: 'Psicolépticos (N05)',
  N06: 'Psicoanalépticos (N06)',
  P02: 'Antihelmínticos (P02)',
  R01: 'Descongestionantes nasales (R01)',
  R03: 'Antiasmáticos / EPOC (R03)',
  R05: 'Antitusivos / expectorantes (R05)',
  R06: 'Antihistamínicos sistémicos (R06)',
}

/** Normaliza un DCI para el emparejamiento: minúsculas, sin diacríticos,
 *  espacios colapsados. Pura. */
export function normalizeDci(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Reglas [raíz normalizada, código ATC nivel 2], en orden de prioridad. Primera
// coincidencia por subcadena gana. Incluye los principios activos observados en
// el piloto y otros frecuentes en Colombia para robustez ante datos futuros.
const RULES: ReadonlyArray<readonly [string, string]> = [
  // — Respiratorio: combos gripales, antihistamínicos, broncodilatadores, mucolíticos —
  ['fenilefrina', 'R01'], ['clorfeniramina', 'R06'], ['pseudoefedrina', 'R01'],
  ['beclometasona', 'R03'], ['ipratropio', 'R03'], ['salbutamol', 'R03'],
  ['fluticasona', 'R03'], ['budesonida', 'R03'], ['bromhexina', 'R05'], ['ambroxol', 'R05'],
  ['desloratadina', 'R06'], ['loratadina', 'R06'], ['levocetiri', 'R06'], ['cetiri', 'R06'],
  ['montelukast', 'R03'],
  // — Antiinfecciosos —
  ['amoxicilina', 'J01'], ['ampicilina', 'J01'], ['sultamicilina', 'J01'],
  ['cefalexina', 'J01'], ['cefadroxilo', 'J01'], ['cefuroxima', 'J01'],
  ['ciprofloxac', 'J01'], ['levofloxac', 'J01'], ['clindamicina', 'J01'],
  ['doxiciclina', 'J01'], ['azitromicina', 'J01'], ['claritromicina', 'J01'],
  ['metronidazol', 'J01'], ['nitrofurantoina', 'J01'], ['trimetoprim', 'J01'],
  ['sulfametoxazol', 'J01'], ['neomicina', 'J01'], ['aciclovir', 'J05'],
  ['fluconazol', 'J02'], ['nistatina', 'J02'],
  // — Musculoesquelético (AINEs) —
  ['meloxicam', 'M01'], ['naproxeno', 'M01'], ['diclofenaco', 'M01'], ['etoricoxib', 'M01'],
  ['ibuprofeno', 'M01'], ['celecoxib', 'M01'], ['ketorolaco', 'M01'], ['piroxicam', 'M01'],
  // — Sistema nervioso —
  ['acetaminofen', 'N02'], ['paracetamol', 'N02'], ['cafeina', 'N06'],
  ['hidroxicina', 'N05'], ['hidroxizina', 'N05'],
  ['acetil salicilico', 'N02'], ['acetilsalicilico', 'N02'],
  ['dipirona', 'N02'], ['metamizol', 'N02'], ['tramadol', 'N02'],
  ['amitriptilina', 'N06'], ['sertralina', 'N06'], ['fluoxetina', 'N06'],
  ['clonazepam', 'N03'], ['alprazolam', 'N05'], ['gabapentina', 'N03'], ['pregabalina', 'N03'],
  // — Cardiovascular —
  ['amlodipino', 'C08'], ['losartan', 'C09'], ['valsartan', 'C09'], ['enalapril', 'C09'],
  ['hidroclorotiazida', 'C03'], ['espironolactona', 'C03'], ['furosemida', 'C03'],
  ['rosuvastatina', 'C10'], ['atorvastatina', 'C10'], ['hidrosmina', 'C05'],
  ['metoprolol', 'C07'], ['carvedilol', 'C07'], ['clopidogrel', 'B01'],
  // — Hormonales sistémicos —
  ['prednisolona', 'H02'], ['prednisona', 'H02'], ['dexametasona', 'H02'],
  ['hidrocortisona', 'H02'], ['levotiroxina', 'H03'],
  // — Genitourinario —
  ['tadalafilo', 'G04'], ['sildenafil', 'G04'], ['tamsulosina', 'G04'], ['finasterida', 'G04'],
  // — Sangre —
  ['acido folico', 'B03'], ['folico', 'B03'], ['tranexamico', 'B02'],
  ['sulfato ferroso', 'B03'], ['hierro', 'B03'], ['enoxaparina', 'B01'], ['warfarina', 'B01'],
  // — Dermatológicos (van antes que los tokens amplios de grupo A) —
  ['betametasona', 'D07'], ['calamina', 'D02'], ['benzoilo', 'D10'], ['adapaleno', 'D10'],
  ['clotrimazol', 'D01'], ['mupirocina', 'D06'], ['yodopolivinil', 'D08'], ['povidona', 'D08'],
  // — Antiparasitarios —
  ['albendazol', 'P02'], ['mebendazol', 'P02'], ['ivermectina', 'P02'],
  // — Fitoterapéutico / homeopático —
  ['homeopatico', FITO], ['chancapiedra', FITO], ['fitoterap', FITO], ['valeriana', FITO],
  // — Digestivo y metabolismo (último: contiene los tokens más amplios) —
  ['omeprazol', 'A02'], ['esomeprazol', 'A02'], ['pantoprazol', 'A02'], ['ranitidina', 'A02'],
  ['hidroxido de aluminio', 'A02'], ['empagliflozina', 'A10'], ['evogliptina', 'A10'],
  ['metformina', 'A10'], ['glibenclamida', 'A10'], ['sitagliptina', 'A10'], ['insulina', 'A10'],
  ['alverina', 'A03'], ['hioscina', 'A03'], ['butilbromuro', 'A03'],
  ['polietilenglicol', 'A06'], ['bisacodilo', 'A06'], ['loperamida', 'A07'],
  ['bacillus clausii', 'A07'], ['saccharomyces', 'A07'], ['nifuroxazida', 'A07'],
  ['complejo b', 'A11'], ['tiamina', 'A11'],
  ['ascorbico', 'A11'], ['vitamina c', 'A11'], ['vitamina a', 'A11'], ['vitamina d', 'A11'],
  ['multivitamin', 'A11'], ['fosfato tricalc', 'A12'], ['calcio', 'A12'], ['zinc', 'A12'],
]

// Memoización del resultado por DCI normalizado. therapeuticGroup y
// therapeuticSubgroup invocan matchCode con los mismos principios activos una y
// otra vez (un medicamento frecuente como "acetaminofen" aparece en muchas
// encuestas, y ambos niveles se derivan por separado), así que cachear evita
// repetir el escaneo lineal de RULES. Es un detalle interno que NO altera el
// determinismo ni la pureza observable: misma entrada → misma salida. Cota LRU
// para acotar la memoria ante un flujo ilimitado de nombres distintos.
const CACHE_MAX = 2000
const codeCache = new Map<string, string | null>()

// Código ATC nivel 2 (o el centinela FITO) del principio activo, o null si no
// se reconoce. Núcleo compartido del que derivan ambos niveles.
function matchCode(dci: string): string | null {
  const d = normalizeDci(dci || '')
  if (!d) return null

  // Sólo se almacenan string|null, nunca undefined → undefined ≡ ausente.
  const cached = codeCache.get(d)
  if (cached !== undefined) {
    // Refresca la posición LRU: reinsertar la deja como la más reciente.
    codeCache.delete(d)
    codeCache.set(d, cached)
    return cached
  }

  let code: string | null = null
  for (const [needle, c] of RULES) {
    if (d.includes(needle)) { code = c; break }
  }

  codeCache.set(d, code)
  if (codeCache.size > CACHE_MAX) {
    // Evacúa la entrada menos usada recientemente (primera del orden de iteración).
    codeCache.delete(codeCache.keys().next().value as string)
  }
  return code
}

/** Grupo terapéutico ATC nivel 1 (anatómico) del principio activo, o
 *  SIN_CLASIFICAR si no se reconoce. Pura y determinista. */
export function therapeuticGroup(dci: string): string {
  const code = matchCode(dci)
  if (!code) return SIN_CLASIFICAR
  if (code === FITO) return GROUP_LABELS[FITO]
  return GROUP_LABELS[code[0]] ?? SIN_CLASIFICAR
}

/** Subgrupo terapéutico ATC nivel 2 del principio activo, o SIN_CLASIFICAR si
 *  no se reconoce. Pura y determinista. */
export function therapeuticSubgroup(dci: string): string {
  const code = matchCode(dci)
  if (!code) return SIN_CLASIFICAR
  if (code === FITO) return GROUP_LABELS[FITO]
  return SUBGROUP_LABELS[code] ?? SIN_CLASIFICAR
}
