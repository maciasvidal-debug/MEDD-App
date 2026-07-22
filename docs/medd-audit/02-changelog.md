# MEDD — Auditoría del piloto · Changelog y verificación (Fases 3–4)

> Qué cambió, evidencia de no-regresión y qué queda pendiente/decisión. Alcance
> aprobado por el stakeholder (2026-07-21): implementar solo las brechas reales
> de la Fase 1 (`01-gap-analysis.md`), priorizando versionado y validaciones
> sobre ATC. Entrega incremental (Scrum) — un commit verificable por incremento.

## Estado de la suite

- **361 tests en verde** (31 → 32 archivos; +23 tests nuevos de regresión).
  `lint` limpio (la única advertencia de `watch()` en Step4 es preexistente),
  `tsc -b` sin errores, `vite build` OK.
- CI (`frontend-ci.yml`): lint → coverage gate → build. Sin cambios de pipeline.

## Evidencia de NO-REGRESIÓN sobre el CSV histórico real

El investigador aportó `MEDD_2026-07-21.csv` (n=114). **No se versiona en el
repo** (contiene PII: direcciones, condiciones de salud — contrario a la propia
política de minimización de esta auditoría). Se validó el parser localmente
contra el archivo real y se confirma que **sigue siendo 100 % parseable** tras
los cambios, reproduciendo exactamente los defectos del informe:

| Métrica (dato real, n=114) | Resultado | Coincide con el informe |
|---|---|---|
| Filas parseadas | 114/114 | ✔ n=114 |
| `instrumentVersion` | 105 v1 (nulas → normalizadas a 1) + 9 v2, **0 nulas** | ✔ 105/114 nulas |
| `ciudad` (grafías) | 40 distintas → **14 canónicas** | ✔ ~39 grafías |
| `departamento` vacío | 114/114 (100 %) | ✔ 100 % vacío |
| `fEta` fuera de rango | 1 registro (2012) | ✔ año 2012 |
| Medicamentos parseados | 94 | — |

El test de regresión versionado (`csv-import.test.ts`) corre en CI contra un
**fixture sintético des-identificado** (`src/test/fixtures/MEDD_pilot_sample.csv`)
que reproduce esos mismos defectos, para no exponer PII en el repositorio.

## Export de muestra con el nuevo esquema

`docs/medd-audit/samples/sample-analitico.csv` (des-identificado) demuestra el
esquema resultante y valida:

- **Sin versiones mezcladas sin declarar / sin nulas** — cada fila trae
  `instrumentVersion` (1 ó 2); la barrera `assertVersioned` no dispara.
- **Catálogos cerrados respetados** — `departamento` derivado, `metodoSeleccion`
  de enum, `ciudad` canónica.
- **`estado_vencimiento` presente** — p. ej.
  `losartán;50;mg;2025-01-10;vencido|Dolex;acetaminofén;500;mg;2027-05-01;vigente`.
- **`hogar_id` poblado** en capturas nuevas (histórico = NULL, por diseño).
- **PII tratada** — sin columna `dir`; `nuiEtr` → `encuestadorCluster` seudónimo.

---

## Cambios por incremento

| Inc. | Rec. | Cambio | Migración | Tests |
|---|---|---|---|---|
| A | 3 | Columna `departamento` (cierra deriva de esquema: el cliente la escribía sin columna) | `016_add_departamento.sql` | mapeo existente |
| B | 1 | `instrumentVersion` **no nulo**: back-fill NULL→1, DEFAULT 1, NOT NULL; normalización en lectura (`fromRow`, `getAllSurveys`); barrera de export `assertVersioned` | `017_instrument_version_backfill.sql` | rechazo de versión nula; round-trip v1 |
| C | 2 | `fEta` en rango `[2024-01-01, hoy]`; bloque de disposición obligatorio si `medSob='Sí'`; edad implausible = error bloqueante | — | rango fEta, disposición, edad |
| D | 5 | `hogarId` (clúster hogar, autogenerado/editable) + `metodoSeleccion` (enum de diseño); captura, esquema, sync, export | `018_hogar_muestreo.sql` | reglas de captura, round-trip, export |
| E | 6 | `toAnalyticalCSV` des-identificado (omite `dir`, seudonimiza `nuiEtr`); nota de tamaño muestral | — | export des-identificado |
| F | 4 | `estado_vencimiento` derivado por producto en el export; ampliación curada (no oficial) de ATC (grupos L/V, +12 subgrupos, ~120 reglas DCI) | — | clasificación ATC nueva; estado en export |
| Fase 4 | — | Parser `parseSurveysCSV` + fixture + test de regresión del CSV histórico | — | regresión histórica (8 tests) |

### Migraciones — idempotencia y rollback

Todas usan guardas (`add column if not exists`, chequeo de `pg_constraint`,
back-fill solo sobre NULLs) y son seguras de re-ejecutar. Rollback documentado
en cada archivo (`016`–`018`). **No se aplicaron a ningún proyecto Supabase en
vivo**: son SQL versionado; su despliegue es un paso de operaciones (aplicar en
orden 016→017→018, antes de desplegar el frontend, para no romper el upsert).

## Cumplimiento (Habeas Data, Ley 1581)

- Export analítico minimizado (mejores prácticas, sin restar poder analítico):
  se omite el localizador directo `dir` y se seudonimiza el identificador de
  encuestador; se conservan las variables analíticas, incluido el texto de salud
  (valor cualitativo). **Riesgo residual**: el texto libre (`prbSalud`,
  `ctoDispVc`, `obs`) puede contener identificadores incidentales — se recomienda
  una revisión/depuración antes de compartir con terceros.
- El export **completo** (con PII) se mantiene para uso interno controlado,
  claramente rotulado.

## Pendiente / requiere tu decisión

1. **ATC oficial.** `atc.ts` es un mapeo **curado, no oficial** (documentado como
   tal). Para uso regulatorio, sustituir por un diccionario ATC de la OMS
   versionado y verificable cuando se disponga de licencia/fuente.
2. **Aplicación de migraciones.** Aplicar `016`–`018` al proyecto Supabase del
   estudio (orden y timing indicados arriba). No se hizo automáticamente.
3. **`hogar_id` histórico.** Quedó NULL en el piloto (decisión aprobada). Si se
   desea agrupar retrospectivamente, definir la regla (p. ej. `dir`+`ciudad`) —
   es heurística y toca interpretación del dato.
4. **Depuración de texto libre** antes de difundir el export analítico a terceros
   (ver cumplimiento).
5. **Método de selección «Otro»** no captura texto libre asociado (se dejó como
   opción simple para acotar el incremento); ampliar si se requiere el detalle.
