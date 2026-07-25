# MEDD · RBQM · Fase 0 — Descubrimiento y línea base

> **Alcance:** describir el estado **real** del repositorio (verificado por lectura
> de código), sin proponer cambios. Fecha de lectura: **2026-07-25**, rama
> `claude/read-attached-prompts-c5695s`.
>
> **Método (anti-alucinación):** todo lo afirmado está anclado a un archivo (y línea
> cuando aplica). Lo que **no** existe en el código se dice explícitamente. Los
> ejemplos de formato salen del fixture des-identificado versionado
> (`src/test/fixtures/MEDD_pilot_sample.csv`), no de datos con PII.

---

## 0. Contexto crítico: este repositorio NO es un punto de partida virgen

El prompt RBQM asume un instrumento por corregir desde cero. **No es el caso.** Una
auditoría previa del piloto (`docs/medd-audit/`, aprobada por el stakeholder el
2026-07-21) ya implementó y **aplicó a producción** (Supabase `MEDD-App`, migraciones
`016`–`020`, el 2026-07-22) buena parte de los controles que el RBQM plantea. Este
documento **reconcilia** el marco RBQM con lo ya hecho para no duplicar ni regresar.

| Doc previo | Contenido |
|---|---|
| `docs/medd-audit/00-baseline.md` | Línea base del código (2026-07-21) |
| `docs/medd-audit/01-gap-analysis.md` | Brechas DMAIC por recomendación |
| `docs/medd-audit/phase2-backlog.md` | Backlog incremental (A–F) |
| `docs/medd-audit/02-changelog.md` | Cambios + no-regresión + migraciones aplicadas a prod |

**Consecuencia para el RBQM:** el registro de riesgos (`01`) marca por cada riesgo
si el control ya existe, es parcial o es un hueco real. La implementación tras el
punto de control debe limitarse a **lo genuinamente faltante**.

---

## 1. Stack real (verificado)

| Capa | Tecnología | Evidencia |
|---|---|---|
| UI | React 19 + TypeScript | `package.json`, `src/**` |
| Bundler | Vite 8 | `vite.config.ts` |
| Estado | Zustand 5 | `src/lib/store.ts` |
| Formularios / validación | React Hook Form 7 + **Zod 4** | `src/lib/validators.ts`, `src/components/survey/*` |
| Persistencia local | IndexedDB (`idb`) — **offline-first** | `src/lib/db.ts` |
| **Backend / DB** | **Supabase (Postgres gestionado, plan Free)** | `src/lib/supabase.ts`, `src/lib/sync.ts`, `supabase/migrations/*` |
| Gráficos | Recharts | `src/pages/Dashboard.tsx` |
| API medicamentos | CUM-INVIMA (`datos.gov.co`) — solo búsqueda | `src/hooks/useCUM.ts` |
| Tests | Vitest 4 + Testing Library | `vitest.config.ts` |
| CI | GitHub Actions: `frontend-ci.yml`, `supabase-keepalive.yml` | `.github/workflows/*` |

**Backend confirmado: Supabase.** El anexo Supabase aplica. El plan es **Free**
(sin backups automáticos, pausa a los 7 días — ya mitigada parcialmente por
`supabase-keepalive.yml`, cron semanal).

## 2. Modelo de datos actual

- **`Survey` = una fila por encuesta** (`src/types/index.ts`), con sub-arreglo 1:N
  **embebido** `medications: Medication[]` (`{nmMed, dci, concMed, undConc, fVto}`).
  En Supabase se persiste como **`medications jsonb`** (no hay tabla hija).
- Para-data / gobernanza: `startedAt?`, `dataEnv?` (`pilot|prod`, estampado
  server-side, inmutable), `backcheckOf?`, `instrumentVersion?`.
- Diseño muestral: `hogarId`, `metodoSeleccion` (añadidos por `018`).
- Bloque conductual v2: `motNoConsumo[]`, `motVencimiento[]`, `dispFinal[]` (+`*Otro`),
  `conocePuntos`, `cualPunto`. **Opcionales por diseño** (NULL ≡ v1 = «no preguntado»).
- **NO existe** `fuente_obtencion` (verificado por búsqueda global: 0 resultados).

### Esquema Supabase (`supabase/migrations/`, 20 migraciones idempotentes)

Tabla `public.surveys`. Constraints de rango existentes (`001_initial.sql`):
`estrato ∈ [1,6]`, `cant_med ≥ 0`, `cant_med_vto ≥ 0`, `peso_med_nc ≥ 0`.
RLS por `user_id` + aislamiento `data_env` (`011`, `015`). Vista `v_product_metrics`
(`security_invoker`, `004`/`019`) que deriva `is_expired`, `t_vto`, `t_disp`, `v_util`
y expone clúster (`nui_etr`, `hogar_id`, `metodo_seleccion`, `instrument_version`,
`departamento`).

**Constraints que NO existen (verificado):** ninguna sobre `f_eta` (ventana temporal
/ no futura), `f_nac ≤ f_eta`, ni edad `∈ [0,110]`. Esas validaciones viven **solo
en el cliente** (`validators.ts`, `quality.ts`), no en el esquema.

## 3. Lógica de export

`src/pages/ExportarPage.tsx` → `src/lib/csv.ts`:
- `toCSV(surveys)` — export completo. Barrera `assertVersioned` **rechaza** `instrumentVersion`
  nulo (guarda de R1, ya implementada). `medications` se empaqueta en **una celda**
  (`nmMed;dci;concMed;undConc;fVto`, productos separados por `|`), con `estado_vencimiento`
  derivado por producto.
- `toAnalyticalCSV()` — export **des-identificado**: omite `dir`, seudonimiza `nuiEtr`
  → `encuestadorCluster`, pasa texto libre por `scrubFreeText` (redacta correos y
  cédulas/teléfonos). Es una desidentificación **en la capa de export**, no una vista
  SQL con RLS por columna.

## 4. `instrumentVersion` y bloque de disposición (estado)

- `INSTRUMENT_VERSION = 2` (`constants.ts`), estampado en `store.addSurvey`.
- DB: `instrument_version` **NOT NULL + DEFAULT 1** (`017`), back-fill NULL→1 aplicado.
- Export: `assertVersioned` impide emitir versión nula. **R1 cerrado.**
- Bloque de disposición: obligatorio **condicional** (`medSob='Sí'`) vía `.refine`
  (`validators.ts`, incremento C). Catálogos cerrados con «Otro» condicional. **No**
  usa enums con `no_sabe`/`no_aplica` explícitos (ver R3, hueco parcial).

## 5. Estado de tests y CI

- **361 tests** (Vitest), coverage gate en `vitest.config.ts`; `frontend-ci.yml` =
  lint → coverage → build.
- Test de regresión histórico: `csv-import.test.ts` parsea el fixture des-identificado
  `src/test/fixtures/MEDD_pilot_sample.csv` (reproduce los defectos del piloto:
  versión nula, `fEta=2012`, grafías de ciudad). El CSV real `MEDD_2026-07-21.csv`
  **no está en el repo** (contiene PII).
- **No hay pruebas de constraints en base de datos** (pgTAP u otras). Las validaciones
  de esquema no están cubiertas por tests automatizados.

## 6. Muestra de formato real (fixture des-identificado, en repo)

De `src/test/fixtures/MEDD_pilot_sample.csv` (datos sintéticos, formato exacto):

- **Fechas:** `YYYY-MM-DD` (`fEta`, `fNac`, `fPrc`, `fDisp`, `fVto`); ISO en timestamps.
- **`medications` (una celda):** `Winadeine;codeína;;;|Amoxal;amoxicilina;250;mg;2026-11-30`
  (nótese el producto sin concentración/vencimiento → celda con campos vacíos).
- **Defecto de versión:** `id-001` trae `instrumentVersion` **vacío** (v1) conviviendo
  con `id-002` = `2`; `id-003` trae **`fEta=2012-06-01`** (error de fecha del piloto).

## 7. PII / cumplimiento (observado)

El instrumento captura PII: `dir`, `prbSalud` (texto de salud), `nuiEtr`, condiciones
de salud. Mitigación actual: desidentificación **en el export analítico** (`toAnalyticalCSV`).
**No hay** RLS por columna que aísle PII por rol, ni una **vista analítica SQL
desidentificada** separada de la operativa (el anexo Supabase la pide). No hay documento
de base de tratamiento/finalidad (Ley 1581).

## 8. Respaldo y continuidad (Free tier)

- **Pausa a 7 días:** mitigada por `supabase-keepalive.yml` (cron `0 8 * * 1`).
- **Backups:** el plan Free no los ofrece y **no existe** una rutina de respaldo propia
  a Storage/externo (verificado: no hay workflow ni Edge Function de backup). Hueco real
  frente al anexo.
- **Grants de la Data API (fecha límite 2026-10-30):** sin nota de verificación en el repo.

---

## 9. Conclusión de la línea base

El instrumento **ya está en buena forma metodológica** gracias a la auditoría previa.
El RBQM **no requiere un rediseño**, sino cerrar un conjunto acotado de huecos, la
mayoría de los cuales llevan la calidad **del cliente al esquema** (defensa en la última
línea, como pide el anexo) más una **variable nueva** (`fuente_obtencion`). El detalle
priorizado está en `01-risk-register.md`; la operacionalización, en `02-control-plan.md`.
