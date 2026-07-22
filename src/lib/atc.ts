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
// ⚠️ FUENTE (importante para el rigor del dato): esta es una tabla CURADA a
// mano, NO el índice ATC oficial de la OMS (WHOCC), del que no se dispone de
// una fuente redistribuible en el repo. Cubre los principios activos frecuentes
// en Colombia con clasificación de nivel 1/2 de alta confianza (farmacología
// estándar). NO debe tratarse como la codificación ATC oficial: para análisis
// regulatorio, sustitúyase por un diccionario ATC versionado y verificable. Las
// entradas se amplían de forma conservadora (solo mapeos inequívocos); un DCI no
// reconocido devuelve SIN_CLASIFICAR (reportado como % de cobertura) en vez de
// arriesgar un código dudoso.
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
  L: 'Antineoplásicos e inmunomoduladores',
  M: 'Musculoesquelético',
  N: 'Sistema nervioso',
  P: 'Antiparasitarios',
  R: 'Respiratorio',
  S: 'Órganos de los sentidos',
  V: 'Varios',
  [FITO]: 'Fitoterapéutico/homeopático',
}

// Nivel 2 — etiqueta legible por código ATC.
const SUBGROUP_LABELS: Record<string, string> = {
  A02: 'Antiácidos / antiulcerosos (A02)',
  A03: 'Antiespasmódicos (A03)',
  A06: 'Laxantes (A06)',
  A07: 'Antidiarreicos / probióticos (A07)',
  A04: 'Antieméticos (A04)',
  A10: 'Antidiabéticos (A10)',
  A11: 'Vitaminas (A11)',
  A12: 'Minerales (A12)',
  B01: 'Antitrombóticos (B01)',
  B02: 'Antihemorrágicos (B02)',
  B03: 'Antianémicos (B03)',
  C01: 'Terapia cardíaca (C01)',
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
  G03: 'Hormonas sexuales (G03)',
  H02: 'Corticoides sistémicos (H02)',
  H03: 'Terapia tiroidea (H03)',
  J01: 'Antibacterianos (J01)',
  J02: 'Antimicóticos (J02)',
  J04: 'Antimicobacterianos (J04)',
  J05: 'Antivirales (J05)',
  L02: 'Terapia endocrina oncológica (L02)',
  L04: 'Inmunosupresores (L04)',
  M01: 'AINE / antirreumáticos (M01)',
  M03: 'Relajantes musculares (M03)',
  M04: 'Antigotosos (M04)',
  M05: 'Óseo / bifosfonatos (M05)',
  N02: 'Analgésicos (N02)',
  N03: 'Antiepilépticos (N03)',
  N05: 'Psicolépticos (N05)',
  N06: 'Psicoanalépticos (N06)',
  P01: 'Antiprotozoarios (P01)',
  P02: 'Antihelmínticos (P02)',
  R01: 'Descongestionantes nasales (R01)',
  R03: 'Antiasmáticos / EPOC (R03)',
  R05: 'Antitusivos / expectorantes (R05)',
  R06: 'Antihistamínicos sistémicos (R06)',
  S01: 'Oftalmológicos (S01)',
  V03: 'Otros productos terapéuticos (V03)',
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
  ['ebastina', 'R06'], ['fexofenadina', 'R06'], ['bilastina', 'R06'],
  ['montelukast', 'R03'], ['formoterol', 'R03'], ['salmeterol', 'R03'],
  ['acetilcisteina', 'R05'], ['guaifenesina', 'R05'], ['dextrometorfano', 'R05'],
  // — Antiinfecciosos —
  ['amoxicilina', 'J01'], ['ampicilina', 'J01'], ['sultamicilina', 'J01'],
  ['cefalexina', 'J01'], ['cefadroxilo', 'J01'], ['cefuroxima', 'J01'],
  ['ciprofloxac', 'J01'], ['levofloxac', 'J01'], ['clindamicina', 'J01'],
  ['doxiciclina', 'J01'], ['azitromicina', 'J01'], ['claritromicina', 'J01'],
  ['metronidazol', 'J01'], ['nitrofurantoina', 'J01'], ['trimetoprim', 'J01'],
  ['sulfametoxazol', 'J01'], ['neomicina', 'J01'],
  ['penicilina', 'J01'], ['dicloxacilina', 'J01'], ['cefixima', 'J01'], ['ceftriaxona', 'J01'],
  ['gentamicina', 'J01'], ['amikacina', 'J01'], ['vancomicina', 'J01'],
  ['aciclovir', 'J05'], ['valaciclovir', 'J05'], ['oseltamivir', 'J05'],
  ['fluconazol', 'J02'], ['nistatina', 'J02'], ['ketoconazol', 'J02'], ['itraconazol', 'J02'],
  ['rifampicina', 'J04'], ['isoniazida', 'J04'], ['etambutol', 'J04'], ['pirazinamida', 'J04'],
  // — Musculoesquelético (AINEs) —
  ['meloxicam', 'M01'], ['naproxeno', 'M01'], ['diclofenaco', 'M01'], ['etoricoxib', 'M01'],
  ['ibuprofeno', 'M01'], ['celecoxib', 'M01'], ['ketorolaco', 'M01'], ['piroxicam', 'M01'],
  ['indometacina', 'M01'], ['aceclofenaco', 'M01'], ['nimesulida', 'M01'],
  ['metocarbamol', 'M03'], ['tizanidina', 'M03'], ['ciclobenzaprina', 'M03'], ['carisoprodol', 'M03'],
  ['colchicina', 'M04'], ['alopurinol', 'M04'],
  ['alendron', 'M05'], ['ibandron', 'M05'], ['risedron', 'M05'], ['acido zoledronico', 'M05'],
  // — Sistema nervioso —
  ['acetaminofen', 'N02'], ['paracetamol', 'N02'], ['cafeina', 'N06'],
  ['hidroxicina', 'N05'], ['hidroxizina', 'N05'],
  ['acetil salicilico', 'N02'], ['acetilsalicilico', 'N02'],
  ['dipirona', 'N02'], ['metamizol', 'N02'], ['tramadol', 'N02'],
  ['codeina', 'N02'], ['morfina', 'N02'], ['hidromorfona', 'N02'], ['oxicodona', 'N02'],
  ['amitriptilina', 'N06'], ['sertralina', 'N06'], ['fluoxetina', 'N06'],
  ['escitalopram', 'N06'], ['citalopram', 'N06'], ['paroxetina', 'N06'],
  ['venlafaxina', 'N06'], ['duloxetina', 'N06'], ['bupropion', 'N06'], ['trazodona', 'N06'],
  ['clonazepam', 'N03'], ['alprazolam', 'N05'], ['gabapentina', 'N03'], ['pregabalina', 'N03'],
  ['diazepam', 'N05'], ['lorazepam', 'N05'], ['quetiapina', 'N05'], ['risperidona', 'N05'],
  ['olanzapina', 'N05'], ['haloperidol', 'N05'], ['levomepromazina', 'N05'],
  ['carbamazepina', 'N03'], ['valproic', 'N03'], ['valproato', 'N03'], ['lamotrigina', 'N03'],
  ['fenitoina', 'N03'], ['levetiracetam', 'N03'], ['fenobarbital', 'N03'], ['topiramato', 'N03'],
  // — Cardiovascular —
  ['amlodipino', 'C08'], ['losartan', 'C09'], ['valsartan', 'C09'], ['enalapril', 'C09'],
  ['telmisartan', 'C09'], ['irbesartan', 'C09'], ['candesartan', 'C09'],
  ['captopril', 'C09'], ['lisinopril', 'C09'], ['ramipril', 'C09'], ['perindopril', 'C09'],
  ['verapamilo', 'C08'], ['diltiazem', 'C08'], ['nifedipino', 'C08'], ['nimodipino', 'C08'],
  ['hidroclorotiazida', 'C03'], ['espironolactona', 'C03'], ['furosemida', 'C03'],
  ['clortalidona', 'C03'], ['indapamida', 'C03'], ['torasemida', 'C03'],
  ['rosuvastatina', 'C10'], ['atorvastatina', 'C10'], ['hidrosmina', 'C05'],
  ['simvastatina', 'C10'], ['lovastatina', 'C10'], ['pravastatina', 'C10'],
  ['gemfibrozilo', 'C10'], ['fenofibrato', 'C10'], ['ezetimiba', 'C10'],
  ['metoprolol', 'C07'], ['carvedilol', 'C07'],
  ['nebivolol', 'C07'], ['bisoprolol', 'C07'], ['atenolol', 'C07'], ['propranolol', 'C07'],
  ['digoxina', 'C01'], ['amiodarona', 'C01'], ['isosorbide', 'C01'], ['dinitrato de isosorbida', 'C01'],
  ['clopidogrel', 'B01'], ['rivaroxaban', 'B01'], ['apixaban', 'B01'],
  ['dabigatran', 'B01'], ['prasugrel', 'B01'], ['ticagrelor', 'B01'],
  // — Hormonales sistémicos —
  ['prednisolona', 'H02'], ['prednisona', 'H02'], ['dexametasona', 'H02'],
  ['hidrocortisona', 'H02'], ['deflazacort', 'H02'], ['metilprednisolona', 'H02'],
  ['levotiroxina', 'H03'], ['tiamazol', 'H03'], ['metimazol', 'H03'], ['propiltiouracilo', 'H03'],
  // — Genitourinario —
  ['tadalafilo', 'G04'], ['sildenafil', 'G04'], ['tamsulosina', 'G04'], ['finasterida', 'G04'],
  ['dutasterida', 'G04'], ['oxibutinina', 'G04'], ['solifenacina', 'G04'],
  ['etinilestradiol', 'G03'], ['estradiol', 'G03'], ['levonorgestrel', 'G03'],
  ['desogestrel', 'G03'], ['noretisterona', 'G03'], ['medroxiprogesterona', 'G03'], ['progesterona', 'G03'],
  // — Sangre —
  ['acido folico', 'B03'], ['folico', 'B03'], ['tranexamico', 'B02'],
  ['sulfato ferroso', 'B03'], ['hierro', 'B03'], ['enoxaparina', 'B01'], ['warfarina', 'B01'],
  // — Antineoplásicos e inmunomoduladores —
  ['tamoxifeno', 'L02'], ['anastrozol', 'L02'], ['letrozol', 'L02'],
  ['metotrexato', 'L04'], ['azatioprina', 'L04'], ['leflunomida', 'L04'],
  ['micofenolato', 'L04'], ['adalimumab', 'L04'], ['etanercept', 'L04'], ['tofacitinib', 'L04'],
  // — Dermatológicos (van antes que los tokens amplios de grupo A) —
  ['betametasona', 'D07'], ['calamina', 'D02'], ['benzoilo', 'D10'], ['adapaleno', 'D10'],
  ['clotrimazol', 'D01'], ['mupirocina', 'D06'], ['yodopolivinil', 'D08'], ['povidona', 'D08'],
  // — Oftalmológicos —
  ['latanoprost', 'S01'], ['brimonidina', 'S01'], ['dorzolamida', 'S01'],
  // — Antiparasitarios / antiprotozoarios —
  ['albendazol', 'P02'], ['mebendazol', 'P02'], ['ivermectina', 'P02'], ['praziquantel', 'P02'],
  ['nitazoxanida', 'P01'], ['tinidazol', 'P01'], ['secnidazol', 'P01'],
  ['cloroquina', 'P01'], ['primaquina', 'P01'],
  // — Varios —
  ['naloxona', 'V03'],
  // — Fitoterapéutico / homeopático —
  ['homeopatico', FITO], ['chancapiedra', FITO], ['fitoterap', FITO], ['valeriana', FITO],
  // — Digestivo y metabolismo (último: contiene los tokens más amplios) —
  ['omeprazol', 'A02'], ['esomeprazol', 'A02'], ['pantoprazol', 'A02'], ['ranitidina', 'A02'],
  ['famotidina', 'A02'], ['sucralfato', 'A02'],
  ['hidroxido de aluminio', 'A02'], ['empagliflozina', 'A10'], ['evogliptina', 'A10'],
  ['metformina', 'A10'], ['glibenclamida', 'A10'], ['sitagliptina', 'A10'], ['insulina', 'A10'],
  ['linagliptina', 'A10'], ['dapagliflozina', 'A10'], ['gliclazida', 'A10'],
  ['dulaglutida', 'A10'], ['liraglutida', 'A10'], ['semaglutida', 'A10'],
  ['ondansetron', 'A04'], ['metoclopramida', 'A03'], ['domperidona', 'A03'],
  ['alverina', 'A03'], ['hioscina', 'A03'], ['butilbromuro', 'A03'], ['pinaverio', 'A03'],
  ['polietilenglicol', 'A06'], ['bisacodilo', 'A06'], ['lactulosa', 'A06'], ['loperamida', 'A07'],
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
