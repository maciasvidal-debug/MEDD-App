# MEDD — Auditoría del piloto · Fase 0: Descubrimiento y línea base

> **Alcance de este documento:** describir el estado **real** del código en la rama
> `claude/medd-pilot-audit-fixes-zgogd7` (verificado por lectura del repositorio),
> sin proponer cambios todavía. Fecha de la lectura: 2026-07-21.
>
> **Nota de método (anti-alucinación):** todo lo afirmado aquí está anclado a un
> archivo y, cuando aplica, a una línea. Cuando algo **no** está en el código se
> dice explícitamente. Los registros de muestra son **reconstruidos a partir del
> esquema** (el CSV histórico `MEDD_2026-07-21.csv` **no está en el repositorio**),
> y se marcan como tales.

---

## 1. Stack real

| Capa | Tecnología (verificada) | Evidencia |
|---|---|---|
| UI | React 19 + TypeScript | `package.json`, `src/**` |
| Bundler | Vite 8 | `package.json`, `vite.config.ts` |
| Estado global | Zustand 5 | `src/lib/store.ts` |
| Formularios / validación | React Hook Form 7 + Zod 4 (`@hookform/resolvers`) | `src/lib/validators.ts`, `src/components/survey/*` |
| Persistencia local | IndexedDB vía `idb` — **offline-first** | `src/lib/db.ts` |
| Backend / DB | **Supabase** (Postgres + RLS + triggers) | `src/lib/supabase.ts`, `src/lib/sync.ts`, `supabase/migrations/*` |
| Gráficos | Recharts | `src/pages/Dashboard.tsx` |
| API medicamentos | CUM-INVIMA (`datos.gov.co`) — opcional, solo búsqueda | `src/hooks/useCUM.ts`, `src/lib/constants.ts` |
| Tests | Vitest 4 + Testing Library; 31 archivos `*.test.ts(x)` | `vitest.config.ts`, `src/**/*.test.*` |
| CI | GitHub Actions: `frontend-ci.yml` (lint + coverage gate + build), `backend-ci.yml`, `supabase-keepalive.yml` | `.github/workflows/*` |

**Backend Express (`backend/`)** existe pero, según el propio `README.md`, **no es
consumido por la app web** (el frontend habla directo con Supabase bajo RLS). Es un
servicio servidor separado, sin despliegue configurado. **Fuera del alcance funcional
del piloto de captura**, aunque comparte convenciones de esquema.

### Cómo se construye el CSV de export

- Disparado en `src/pages/ExportarPage.tsx` → `toCSV(surveys)` /
  `toCodebookCSV()` (`src/lib/csv.ts`), descargado como
  `MEDD_<fecha>.csv` mediante `downloadBlob` (`src/lib/utils.ts`).
- `toCSV` emite (a) columnas base en orden de codebook, (b) `duracion_s` derivada
  (`createdAt − startedAt`), (c) columnas de la batería de motivos v2, y (d) una
  **única** columna `medications` empaquetando cada producto
  (`nmMed;dci;concMed;undConc;fVto`, productos separados por `|`). Lleva BOM UTF-8.
- Existe además un **codebook auto-descriptivo** exportable (`toCodebookCSV`) a
  partir de `CODEBOOK` en `src/lib/constants.ts`.
- **El export opera sobre `store.surveys` sin filtrar por versión de instrumento
  ni bloquear registros con `instrumentVersion` nulo** (ver Fase 1, Rec. 1).

---

## 2. Modelo de datos actual

### 2.1 Tipo de dominio (`src/types/index.ts`)

`Survey` es **una fila por encuesta** con un sub-arreglo 1:N `medications:
Medication[]`. Campos relevantes para la auditoría:

- **Para-data / gobernanza:** `startedAt?`, `dataEnv?` (`'pilot' | 'prod'`),
  `backcheckOf?`, `instrumentVersion?`.
- **Encuestador (snapshot):** `nuiEtr` (ID único del encuestador, entero positivo),
  `etrPrograma`, `etrTipoInst`, `etrSemestre`, `etrInstitucion`.
- **Sociodemografía:** `fNac`, `ciudad`, `departamento?`, `dir`, `estrato`, `etnia`,
  `asSalud`, `estLab`, `ingreso`, `nvEstu`, `nvPosg`.
- **Salud:** cadena condicional `perSalud → estSalud → prbSalud → conMed → medPrc →
  fPrc/fDisp → indMed`.
- **Almacenamiento/disposición:** `medSob`, `dispMedVc`, `ctoDispVc`, `vtoMedNc`,
  `cantMed`, `cantMedVto`, `pesoMedNc` (numérico en **gramos**, declarado así en
  `CODEBOOK` y en `FIELD_GUIDE`).
- **Batería de motivos v2 (aditiva, opcional por diseño):** `motNoConsumo[]`,
  `motNoConsumoOtro`, `motVencimiento[]`, `motVencimientoOtro`, `dispFinal[]`,
  `dispFinalOtro`, `conocePuntos`, `cualPunto`.
- **NO existe** ningún campo de **identificador de hogar** (`hogar_id`) ni de
  **método de selección muestral** (verificado por búsqueda global; ver Fase 1, Rec. 5).

### 2.2 Esquema Supabase (`supabase/migrations/`)

15 migraciones idempotentes (`if not exists`, guardas `do $$ … pg_constraint`).
Tabla `public.surveys` (fila única, `medications jsonb`), RLS por `user_id`, y
`v_product_metrics` (`security_invoker`) que deriva en SQL `is_expired`, `t_vto`,
`t_disp`, `v_util`.

| Migración | Aporte |
|---|---|
| `001_initial` | tabla `surveys`, constraints (`estrato` 1–6, `cant_*`/`peso ≥ 0`), RLS, vista `v_product_metrics` |
| `002_roles` / `015_access_control` | roles `encuestador`/`investigador`; `user_roles.active` — **cuentas nuevas arrancan inactivas** (defensa en profundidad) |
| `007_add_surveyor_profile`, `008_user_profiles` | perfil del encuestador (sincronizado a la cuenta) |
| `009_add_started_at` | para-data `started_at` |
| `010_data_env` / `011_..._rls_cutover` | discriminador `data_env` (**estampado server-side por trigger**, inmutable), aislamiento RLS piloto/producción |
| `012_backcheck` | `backcheck_of` (re-entrevista de control) |
| `013_add_motives` | `instrument_version` + columnas de la batería de motivos v2 (todas nullable, sin backfill: NULL ≡ v1) |

### 2.3 Manejo actual de `instrumentVersion`

- Constante `INSTRUMENT_VERSION = 2` (`src/lib/constants.ts`).
- **Se estampa en cada captura nueva** en `store.addSurvey` (`instrumentVersion:
  INSTRUMENT_VERSION`). `updateSurvey` conserva el valor existente.
- Se mapea a/desde Supabase (`instrument_version`) en `sync-mapping.ts`
  (`survey.instrumentVersion ?? null` en escritura; `?? undefined` en lectura).
- Se exporta en el CSV (columna `instrumentVersion`).
- **Semántica actual:** `undefined`/`null` ≡ v1 («No preguntado» para la batería
  de motivos). Codebook: *«vacío = 1»*.
- **Limitaciones (detalle en Fase 1):** no hay **restricción NOT NULL** en el
  esquema, no hay **back-fill** que fije `= 1` en los registros históricos v1, y
  el **export no impide** exportar registros con versión nula ni mezclar versiones.

### 2.4 Bloque conductual (motivos / disposición)

Presente y funcional (instrumento v2): capturado en `Step4.tsx` con catálogos
cerrados (`OPT.motNoConsumo`, `OPT.motVencimiento`, `OPT.dispFinal`) + opción
«Otro» con texto libre condicional (validado en `step4Refine`). **Opcional por
diseño** para no romper la lectura de registros v1. El dashboard reclasifica el
texto libre histórico v1 por palabras clave (`src/lib/text-analysis.ts`).

---

## 3. Estado de tests y CI

- **31** archivos de test (`src/**/*.test.ts(x)`), incluyendo cobertura de
  `csv`, `sync-mapping`, `validators`, `quality`, `atc`, `divipola`, `ciudad`,
  `date`, `store`, `dashboard-metrics`, `insights`, `text-analysis`.
- `frontend-ci.yml`: `npm run lint` → `npm run test:coverage` (**coverage gate**,
  umbrales en `vitest.config.ts`) → `npm run build` (`tsc -b` + `vite build`).
- **No existe** hoy ningún test que:
  - cargue/parsee el **CSV histórico** `MEDD_2026-07-21.csv` (el archivo no está
    en el repo), ni
  - **rechace** un export con `instrumentVersion` nulo o con versiones mezcladas.

---

## 4. Muestra de formato (reconstruida del esquema — NO son registros reales)

> El CSV histórico `MEDD_2026-07-21.csv` **no está en el repositorio**, por lo que
> no es posible mostrar registros reales anonimizados. Los siguientes ejemplos
> **reproducen el formato exacto** que emite `toCSV`/`sync-mapping` (verificado en
> código), con datos sintéticos. Sirven para confirmar el formato de `medications`
> y de fechas, no como evidencia de dato real.

**Fechas:** siempre `YYYY-MM-DD` (columnas `f_eta`, `f_nac`, `f_prc`, `f_disp`,
`fVto`); timestamps ISO en `created_at`/`updated_at`/`started_at`.

**`medications` (una sola celda por encuesta):**

```
nmMed;dci;concMed;undConc;fVto|nmMed;dci;concMed;undConc;fVto
```

Ejemplos sintéticos (formato real):

```
Dolex;acetaminofén;500;mg;2025-03-01|Amoxal;amoxicilina;250;mg;2026-11-30
Winadeine;;;;                       (producto sin DCI/concentración/vencimiento)
```

Fila de encuesta (columnas abreviadas, formato real):

| id | fEta | fNac | ciudad | departamento | estrato | medSob | vtoMedNc | instrumentVersion | medications |
|---|---|---|---|---|---|---|---|---|---|
| `uuid-A` (sintético) | 2026-05-10 | 1980-02-14 | Barranquilla | Atlántico | 2 | Sí | Sí | 2 | `Dolex;acetaminofén;500;mg;2025-03-01` |
| `uuid-B` (sintético) | 2026-05-11 | 1965-07-30 | Soledad | Atlántico | 1 | No | | *(vacío = v1)* | *(vacío)* |

Estos dos casos ilustran el defecto dominante del piloto tal como se manifiesta
hoy en el export: un registro **v2** (versión 2, motivos capturados) conviviendo
en el mismo archivo con un registro **sin versión** (v1), sin barrera que lo
separe o lo marque explícitamente como versión 1.

---

## 5. Consideraciones de PII / cumplimiento (observadas, no resueltas aquí)

El export analítico (`toCSV`) incluye campos con **datos personales**: `dir`
(dirección de residencia), `prbSalud` (problema de salud, texto libre),
`ctoDispVc` (práctica de disposición, texto libre) y `nuiEtr` (ID del
encuestador). No hay hoy una política de minimización/seudonimización en el
export analítico. Se documenta como **decisión de cumplimiento pendiente**
(Habeas Data, Ley 1581) en la Fase 1, Rec. 6 y en las reglas de parada.

---

## 6. Conclusión de la línea base

El código **ya implementa** buena parte de la Sección 7 del informe (instrumento
v2 versionado y estampado, catálogo DANE offline con canonicalización de
`ciudad`, `departamento` derivado, inventario estructurado, cálculo de
vencimiento en analítica, para-data y separación piloto/producción
server-side). El informe describe el **estado del dato exportado en el piloto**,
no el estado actual del código. Por tanto, la Fase 1 debe **medir brecha real
por recomendación** y limitar la implementación a lo genuinamente faltante —
principalmente: **enforcement de `instrumentVersion` no nulo + back-fill +
guarda de export**, **validaciones de rango/obligatoriedad en captura**,
**`hogar_id` y diseño muestral**, y una **deriva de esquema** (`departamento`
sin columna en migraciones). La codificación **ATC** y el **CSV histórico**
disparan reglas de parada (ver Fase 1).
