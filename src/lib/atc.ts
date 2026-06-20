// =====================================================================
// Clasificación terapéutica (ATC nivel 1) de medicamentos.
//
// Mapea el principio activo (DCI, texto libre y con ruido: sufijos de sal,
// "equivalente a…", concentraciones, combinaciones) a su grupo anatómico
// principal de la clasificación ATC de la OMS. Es una función PURA y
// determinista: misma entrada → misma salida, sin efectos ni estado, por lo
// que es segura e idempotente y trivial de testear.
//
// Estrategia: normalizar (minúsculas, sin tildes, espacios colapsados) y
// buscar la primera RAÍZ de principio activo presente como subcadena. Las
// reglas están ORDENADAS: las combinaciones gripales/antihistamínicos y los
// tokens específicos van antes que los tokens amplios del grupo A (calcio,
// zinc, vitaminas), de modo que p. ej. "calamina (óxido de zinc…)" cae en
// Dermatológicos y no en Digestivo/metabolismo.
//
// Las combinaciones se clasifican por el primer componente reconocido. La
// cobertura es medible: cualquier DCI sin coincidencia devuelve SIN_CLASIFICAR
// (se reporta como % en la analítica para no sobre-interpretar).
// =====================================================================

export const SIN_CLASIFICAR = 'Sin clasificar'

// Etiquetas de grupo (ATC nivel 1) + uno extra no-ATC para fitoterapia/homeopatía.
const G = {
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
  FITO: 'Fitoterapéutico/homeopático',
} as const

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

// Reglas [raíz normalizada, grupo], en orden de prioridad. Primera coincidencia
// por subcadena gana. Incluye los principios activos observados en el piloto y
// otros frecuentes en Colombia para robustez ante datos futuros.
const RULES: ReadonlyArray<readonly [string, string]> = [
  // — Respiratorio: combos gripales, antihistamínicos, broncodilatadores, mucolíticos —
  ['fenilefrina', G.R], ['clorfeniramina', G.R], ['pseudoefedrina', G.R],
  ['beclometasona', G.R], ['ipratropio', G.R], ['salbutamol', G.R],
  ['fluticasona', G.R], ['budesonida', G.R], ['bromhexina', G.R], ['ambroxol', G.R],
  ['desloratadina', G.R], ['loratadina', G.R], ['levocetiri', G.R], ['cetiri', G.R],
  ['montelukast', G.R],
  // — Antiinfecciosos —
  ['amoxicilina', G.J], ['ampicilina', G.J], ['sultamicilina', G.J],
  ['cefalexina', G.J], ['cefadroxilo', G.J], ['cefuroxima', G.J],
  ['ciprofloxac', G.J], ['levofloxac', G.J], ['clindamicina', G.J],
  ['doxiciclina', G.J], ['azitromicina', G.J], ['claritromicina', G.J],
  ['metronidazol', G.J], ['nitrofurantoina', G.J], ['trimetoprim', G.J],
  ['sulfametoxazol', G.J], ['neomicina', G.J], ['aciclovir', G.J],
  ['fluconazol', G.J], ['nistatina', G.J],
  // — Musculoesquelético (AINEs) —
  ['meloxicam', G.M], ['naproxeno', G.M], ['diclofenaco', G.M], ['etoricoxib', G.M],
  ['ibuprofeno', G.M], ['celecoxib', G.M], ['ketorolaco', G.M], ['piroxicam', G.M],
  // — Sistema nervioso —
  ['acetaminofen', G.N], ['paracetamol', G.N], ['cafeina', G.N],
  ['hidroxicina', G.N], ['hidroxizina', G.N],
  ['acetil salicilico', G.N], ['acetilsalicilico', G.N],
  ['dipirona', G.N], ['metamizol', G.N], ['tramadol', G.N],
  ['amitriptilina', G.N], ['sertralina', G.N], ['fluoxetina', G.N],
  ['clonazepam', G.N], ['alprazolam', G.N], ['gabapentina', G.N], ['pregabalina', G.N],
  // — Cardiovascular —
  ['amlodipino', G.C], ['losartan', G.C], ['valsartan', G.C], ['enalapril', G.C],
  ['hidroclorotiazida', G.C], ['espironolactona', G.C], ['furosemida', G.C],
  ['rosuvastatina', G.C], ['atorvastatina', G.C], ['hidrosmina', G.C],
  ['metoprolol', G.C], ['carvedilol', G.C], ['clopidogrel', G.C],
  // — Hormonales sistémicos —
  ['prednisolona', G.H], ['prednisona', G.H], ['dexametasona', G.H],
  ['hidrocortisona', G.H], ['levotiroxina', G.H],
  // — Genitourinario —
  ['tadalafilo', G.G], ['sildenafil', G.G], ['tamsulosina', G.G], ['finasterida', G.G],
  // — Sangre —
  ['acido folico', G.B], ['folico', G.B], ['tranexamico', G.B],
  ['sulfato ferroso', G.B], ['hierro', G.B], ['enoxaparina', G.B], ['warfarina', G.B],
  // — Dermatológicos (van antes que los tokens amplios de grupo A) —
  ['betametasona', G.D], ['calamina', G.D], ['benzoilo', G.D], ['adapaleno', G.D],
  ['clotrimazol', G.D], ['mupirocina', G.D], ['yodopolivinil', G.D], ['povidona', G.D],
  // — Antiparasitarios —
  ['albendazol', G.P], ['mebendazol', G.P], ['ivermectina', G.P],
  // — Fitoterapéutico / homeopático —
  ['homeopatico', G.FITO], ['chancapiedra', G.FITO], ['fitoterap', G.FITO], ['valeriana', G.FITO],
  // — Digestivo y metabolismo (último: contiene los tokens más amplios) —
  ['omeprazol', G.A], ['esomeprazol', G.A], ['pantoprazol', G.A], ['ranitidina', G.A],
  ['hidroxido de aluminio', G.A], ['empagliflozina', G.A], ['evogliptina', G.A],
  ['metformina', G.A], ['glibenclamida', G.A], ['sitagliptina', G.A], ['insulina', G.A],
  ['alverina', G.A], ['hioscina', G.A], ['butilbromuro', G.A],
  ['polietilenglicol', G.A], ['bisacodilo', G.A], ['loperamida', G.A],
  ['bacillus clausii', G.A], ['saccharomyces', G.A], ['nifuroxazida', G.A],
  ['complejo b', G.A], ['tiamina', G.A],
  ['ascorbico', G.A], ['vitamina c', G.A], ['vitamina a', G.A], ['vitamina d', G.A],
  ['multivitamin', G.A], ['fosfato tricalc', G.A], ['calcio', G.A], ['zinc', G.A],
]

/** Devuelve el grupo terapéutico (ATC nivel 1) del principio activo, o
 *  SIN_CLASIFICAR si no se reconoce. Pura y determinista. */
export function therapeuticGroup(dci: string): string {
  const d = normalizeDci(dci || '')
  if (!d) return SIN_CLASIFICAR
  for (const [needle, group] of RULES) {
    if (d.includes(needle)) return group
  }
  return SIN_CLASIFICAR
}
