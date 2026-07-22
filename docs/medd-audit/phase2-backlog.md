# MEDD — Auditoría del piloto · Fase 2: Backlog incremental (Scrum)

> Ordenado por **riesgo/valor**. Cada incremento es verificable de forma
> aislada, con criterios de aceptación y pruebas. Prioriza **versionado y
> validaciones** (previenen el defecto dominante) por encima de ATC, según lo
> aprobado. Decisiones del stakeholder (2026-07-21):
> - Alcance acotado a las brechas de la Fase 1 — **aprobado**.
> - ATC: no hay fuente oficial → ampliar `atc.ts` como **mapeo curado no oficial**
>   (niveles 1–2), documentado; **baja prioridad**.
> - CSV histórico: **lo aporta el stakeholder**; entretanto, fixture sintético.
> - PII: **mejores prácticas sin restar poder analítico** → export analítico
>   des-identificado.
> - `hogar_id` histórico: **NULL** (poblar desde la próxima ola).

---

## Increment A — Migración `departamento` (Rec. 3, deriva de esquema) · 🔴 riesgo de sync
- **Objetivo:** que el esquema versionado incluya la columna `departamento` que el
  cliente ya escribe (`sync-mapping.ts:64`), cerrando un fallo de sync en un
  proyecto reconstruido desde `migrations/`.
- **Archivos:** `supabase/migrations/016_add_departamento.sql` (nuevo).
- **Criterios de aceptación:**
  - Migración idempotente (`add column if not exists`), aditiva, nullable.
  - Comentario de columna coherente con el codebook.
  - Re-ejecutable sin efecto.
- **Pruebas:** revisión de idempotencia (SQL); el mapeo `toRow` ya cubre el campo
  (`sync-mapping.test.ts`).

## Increment B — Versionado obligatorio (Rec. 1) · 🔴 defecto dominante
- **Objetivo:** que **ningún registro** tenga `instrumentVersion` nulo y que el
  export **no** pueda emitir versiones nulas.
- **Archivos:** `supabase/migrations/017_instrument_version_backfill.sql` (nuevo),
  `src/lib/sync-mapping.ts` (normalizar lectura a `1`), `src/lib/db.ts` o carga
  (normalización defensiva), `src/lib/csv.ts` (guarda de export),
  `src/lib/csv.test.ts`, `src/lib/sync-mapping.test.ts`.
- **Criterios de aceptación:**
  - Migración: `UPDATE … SET instrument_version=1 WHERE instrument_version IS NULL`
    (solo NULLs), luego `DEFAULT 1` + `NOT NULL`. Idempotente. Rollback documentado.
  - Al leer un registro sin versión (histórico local), se normaliza a `1`.
  - `toCSV` **lanza** si algún registro llega con versión nula/indefinida
    (fail-fast); ExportarPage muestra el error en vez de exportar dato ambiguo.
  - Cada fila declara su versión en la columna `instrumentVersion` (versiones
    separables por columna — cumple «no mezclar sin declarar»).
- **Pruebas:** test que **falla** si `toCSV` acepta versión nula; test de
  normalización en `fromRow`.

## Increment C — Validaciones de captura (Rec. 2) · 🟠 Quality by Design
- **Objetivo:** que lo implausible **no entre** en captura (no solo warning post).
- **Archivos:** `src/lib/constants.ts` (`STUDY_START='2024-01-01'`),
  `src/lib/validators.ts` (rango `fEta`, disposición obligatoria, edad),
  `src/lib/quality.ts` (edad implausible → error), tests correspondientes,
  y el componente del paso si requiere props (revisión).
- **Criterios de aceptación:**
  - `fEta` rechaza fechas `< STUDY_START` o `> hoy`.
  - Con `medSob='Sí'`, el bloque de disposición (`dispMedVc`, `vtoMedNc`) es
    obligatorio.
  - Edad fuera de `[0,110]` bloquea el guardado (error, no warning).
- **Pruebas:** casos válidos/ inválidos por regla en `validators.test.ts` /
  `quality.test.ts`.

## Increment D — `hogar_id` + diseño muestral (Rec. 5) · 🔴 brecha central
- **Objetivo:** hacer modelable el agrupamiento por hogar y registrar el método de
  selección; preservar el clúster de encuestador (ya existe).
- **Archivos:** `src/types/index.ts`, `src/lib/constants.ts`
  (`OPT.metodoSeleccion`, `EMPTY_DRAFT`, `CODEBOOK`), un paso del asistente
  (captura de `hogarId` + `metodoSeleccion`), `src/lib/sync-mapping.ts`,
  `src/lib/csv.ts`, `supabase/migrations/018_hogar_muestreo.sql` (nuevo), tests.
- **Criterios de aceptación:**
  - `hogarId` es texto estable (por defecto autogenerado por captura, editable
    para vincular varias personas del mismo hogar); nullable en históricos.
  - `metodoSeleccion` es enum cerrado con «Otro».
  - Round-trip `toRow`/`fromRow` y export incluyen ambos.
  - Históricos → `hogar_id` NULL (documentado); sin fusión de registros.
- **Pruebas:** round-trip y presencia en export.

## Increment E — Export des-identificado + nota de tamaño muestral (Rec. 6) · 🟠 cumplimiento
- **Objetivo:** un export analítico que minimiza reidentificación **sin** perder
  poder analítico, y la nota de método para dimensionar la próxima ola.
- **Archivos:** `src/lib/csv.ts` (`toAnalyticalCSV` des-identificado),
  `src/pages/ExportarPage.tsx` (botón), `src/lib/csv.test.ts`,
  `docs/medd-audit/sample-size-note.md` (nuevo).
- **Criterios de aceptación:**
  - Export analítico **omite** el localizador directo `dir` y **seudonimiza** el
    identificador de encuestador a un código de clúster estable; conserva las
    variables con valor analítico (incl. texto de salud, que alimenta el análisis
    cualitativo) y añade `hogar_id`/versión/clúster limpios.
  - El export completo (con PII) se mantiene, claramente rotulado.
  - Nota de método: n objetivo desde `medSob≈0,79`, precisión y efecto de diseño
    (ICC≈0,27).
- **Pruebas:** el export analítico no contiene `dir` ni el `nuiEtr` crudo.

## Increment F — Ampliar ATC + estado de vencimiento en export (Rec. 4) · 🟢 menor prioridad
- **Objetivo:** más cobertura de clasificación terapéutica (curada, no oficial) y
  dejar el estado de vencimiento explícito en el export.
- **Archivos:** `src/lib/atc.ts` (más reglas DCI→ATC nivel 1/2, completar grupos;
  nota de fuente no oficial), `src/lib/csv.ts` (estado de vencimiento por
  producto), tests.
- **Criterios de aceptación:**
  - `atc.ts` documenta explícitamente que es un **mapeo curado, no el índice ATC
    oficial de la OMS**, determinista y testeado; se amplían reglas de alta
    confianza sin inventar códigos dudosos.
  - El export incluye el estado de vencimiento derivado por producto.
- **Pruebas:** clasificación de nuevos DCI; estado de vencimiento en export.

## Fase 4 — Regresión sobre CSV histórico + verificación + changelog
- **Objetivo:** garantizar no-regresión de lectura del dato histórico y cerrar la
  auditoría.
- **Archivos:** parser/arnés de parseo del CSV histórico, fixture (real cuando el
  stakeholder lo aporte; sintético entretanto), export de muestra,
  `docs/medd-audit/02-changelog.md` (nuevo).
- **Criterios de aceptación:** el CSV histórico (v1 y v2 mezclados) sigue siendo
  parseable; export de muestra valida catálogos, versión, `hogar_id`, estado de
  vencimiento y política PII.
