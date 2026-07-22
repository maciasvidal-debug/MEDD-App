// =====================================================================
// Clasificación terapéutica (ATC) de medicamentos — niveles 1 y 2.
//
// Mapea el principio activo (DCI, texto libre y con ruido: sufijos de sal,
// "equivalente a…", concentraciones, combinaciones) a su subgrupo ATC nivel 2
// (p. ej. J01 antibacterianos, C09 IECA/ARA-II). De ese código de 3 caracteres
// se derivan AMBOS niveles: el nivel 1 (grupo anatómico) es la primera letra.
//
// ─── FUENTE (rigor del dato) ────────────────────────────────────────────────
// El diccionario DCI→ATC nivel 2 proviene de una FUENTE VERIFICABLE y de datos
// abiertos: el CUM de INVIMA (datos.gov.co i7cb-raxc), no de códigos escritos de
// memoria. Ver `atc-cum.data.ts` y el generador reproducible `scripts/
// gen_atc_lookup.py`. Sobre esa base sourced se aplica una capa PEQUEÑA y
// ANOTADA de correcciones (`ATC_OVERRIDES`) para el sesgo por combinado del CUM
// y para fármacos comunes ausentes del snapshot «vigentes» — cada override lleva
// su código ATC oficial y la razón. Un DCI no reconocido devuelve SIN_CLASIFICAR
// (reportado como % de cobertura), nunca un código arriesgado.
//
// Determinista y referencialmente transparente (misma entrada → misma salida).
// Memoiza el emparejamiento por DCI canónico (detalle interno).
// =====================================================================
import { ATC_LEVEL2_BY_INGREDIENT } from './atc-cum.data'

export const SIN_CLASIFICAR = 'Sin clasificar'

const FITO = 'FITO' // centinela: fitoterapéutico/homeopático (fuera de ATC)

// Nivel 1 — grupo anatómico por letra ATC (taxonomía oficial OMS) + bucket FITO.
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

// Nivel 2 — etiqueta legible en español por subgrupo ATC. Cubre los subgrupos
// presentes en el estudio; para cualquier otro (fármacos futuros) se muestra el
// código ATC como respaldo legible (ver `subgroupLabel`).
const SUBGROUP_LABELS: Record<string, string> = {
  A02: 'Antiácidos / antiulcerosos (A02)',
  A03: 'Antiespasmódicos (A03)',
  A04: 'Antieméticos (A04)',
  A06: 'Laxantes (A06)',
  A07: 'Antidiarreicos / probióticos (A07)',
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
  G03: 'Hormonas sexuales (G03)',
  G04: 'Urológicos (G04)',
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

// Capa de correcciones sobre la base CUM. Cada entrada lleva su ATC oficial y la
// razón; se aplica ANTES del lookup CUM (gana sobre él). Claves = principio
// activo CANÓNICO (ver `canonical`).
const ATC_OVERRIDES: Record<string, string> = {
  // Sesgo por combinado del CUM (la moda cae en un código de asociación):
  cafeina: 'N06',                     // cafeína = N06BC01; CUM moda M01 (combos analgésicos)
  calamina: 'D02',                    // calamina = D02AB; CUM devuelve C05
  'acido acetilsalicilico': 'N02',    // AAS = N02BA01 (ATC primaria OMS); + consistencia entre grafías
  'acido acetil salicilico': 'N02',
  aspirina: 'N02',
  // Fármacos comunes ausentes/renombrados en el snapshot CUM «vigentes» (ATC oficial):
  atenolol: 'C07',                    // C07AB03 (sin filas en el snapshot)
  digoxina: 'C01',                    // C01AA05 (el snapshot solo trae derivados)
  alendronato: 'M05',                 // = ácido alendrónico, M05BA04 (sinónimo)
  // Suplementos que el CUM no resuelve a un ingrediente único:
  calcio: 'A12',                      // A12AA
  'complejo b': 'A11',                // vitaminas del complejo B, A11E
}

// Tokens que marcan fitoterapéutico/homeopático (fuera del sistema ATC).
const FITO_TOKENS = ['homeopat', 'chancapiedra', 'fitoterap', 'naturista', 'valeriana']

// ─── Normalización ──────────────────────────────────────────────────────────

/** Minúsculas, sin diacríticos, espacios colapsados. Pura. */
export function normalizeDci(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Espejo EXACTO de `canonical` en scripts/gen_atc_lookup.py: extrae el principio
// activo canónico del texto ruidoso (quita paréntesis, "equivalente a …",
// concentraciones, unidades, sales/hidratos y conectores). Debe coincidir con el
// generador o los emparejamientos exactos fallarían.
const SALT = /\b(clorhidrato|diclorhidrato|hidrocloruro|bromhidrato|bromuro|sulfato|bisulfato|sodico|sodica|sodio|potasico|potasica|potasio|calcico|calcica|magnesico|maleato|mesilato|besilato|fumarato|hemifumarato|tartrato|bitartrato|succinato|fosfato|difosfato|acetato|dipropionato|propionato|valerato|palmitato|estearato|gluconato|lactato|citrato|nitrato|pamoato|embonato|pivalato|furoato|xinafoato|dihidrato|trihidrato|monohidrato|heptahidrato|pentahidrato|hemihidrato|tetrahidratado|anhidro|anhidra|micronizado|micronizada|base|racemico|bp|usp)\b/g
const UNITS = /\b(mg|mcg|ug|g|gr|kg|ml|l|ui|iu|u|meq|mmol|mol|dosis|puff|comprimido|tableta|capsula|ampolla|frasco|vial|sobre|parche|inhalacion|via|oral|elemental|origen|porcino)\b/g
const STOP = /\b(de|del|la|el|e|y|como|en|forma|equivalente|a|o|cada|mas)\b/g

export function canonical(raw: string): string {
  let s = (raw || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  s = s.replace(/\([^)]*\)/g, ' ')
  if (s.includes('equivalente a')) s = s.split('equivalente a').pop() as string
  s = s.replace(/[0-9]+([.,][0-9]+)?/g, ' ')
  s = s.replace(/[/%.,;:+()-]/g, ' ')
  s = s.replace(UNITS, ' ')
  for (let i = 0; i < 3; i++) s = s.replace(SALT, ' ')
  s = s.replace(STOP, ' ')
  return s.replace(/\s+/g, ' ').trim()
}

// Tabla combinada (override gana), y claves ordenadas por longitud desc para el
// emparejamiento por subcadena de palabra completa (combos / DCI compuestos).
const TABLE: Record<string, string> = { ...ATC_LEVEL2_BY_INGREDIENT, ...ATC_OVERRIDES }
const KEYS_BY_LEN: string[] = Object.keys(TABLE).sort((a, b) => b.length - a.length)

// Memoización LRU del subgrupo por DCI canónico.
const CACHE_MAX = 2000
const codeCache = new Map<string, string | null>()

/** Subgrupo ATC nivel 2 (3 chars) del DCI, el centinela FITO, o null. */
function matchCode(dci: string): string | null {
  const c = canonical(dci)
  if (!c) return null

  const cached = codeCache.get(c)
  if (cached !== undefined) {
    codeCache.delete(c); codeCache.set(c, cached) // refresca LRU
    return cached
  }

  let code: string | null = null
  if (FITO_TOKENS.some(t => c.includes(t))) {
    code = FITO
  } else if (TABLE[c]) {
    code = TABLE[c]
  } else {
    // Subcadena por palabra completa, la clave más larga gana (clasifica un combo
    // por su componente reconocido más específico). Se ignoran claves < 4 chars.
    for (const k of KEYS_BY_LEN) {
      if (k.length < 4) break
      if (new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(c)) { code = TABLE[k]; break }
    }
  }

  codeCache.set(c, code)
  if (codeCache.size > CACHE_MAX) codeCache.delete(codeCache.keys().next().value as string)
  return code
}

function subgroupLabel(code: string): string {
  return SUBGROUP_LABELS[code] ?? `Subgrupo ATC ${code}`
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
  return subgroupLabel(code)
}
