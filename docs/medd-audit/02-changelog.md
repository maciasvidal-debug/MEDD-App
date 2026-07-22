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
| Analítica | 5 · 6 | `v_product_metrics` expone `nui_etr`, `hogar_id`, `metodo_seleccion`, `instrument_version` y `departamento`, para modelar el agrupamiento (ICC) y separar denominadores por versión desde SQL (rol investigador) | `019_metrics_view_clustering.sql` | vista (sin test JS) |
| ATC | 4 | `atc.ts` migra de reglas de memoria a diccionario DCI→ATC **de fuente verificable** (CUM INVIMA, `atc-cum.data.ts` + `scripts/gen_atc_lookup.py`) con extracción de principio activo canónico y preferencia por monofármaco (corrige el sesgo por combinado); capa anotada de correcciones/FITO | — | 18 tests: set sourced, DCIs reales del piloto, procedencia |

### Migraciones — idempotencia, rollback y aplicación

Todas usan guardas (`add column if not exists`, chequeo de `pg_constraint`,
back-fill solo sobre NULLs; la vista `019` es `create or replace`) y son seguras
de re-ejecutar. Rollback documentado en cada archivo (`016`–`019`).

**Aplicadas a producción el 2026-07-22** (proyecto Supabase `MEDD-App`), en orden
016→017→018→019. El plan Free no permite branches de base de datos, así que la
validación previa se hizo en un **Postgres local desechable** sembrado como
producción (105 filas versión-NULL + 9 v2): aplican limpio, son idempotentes
(2ª pasada sin efecto) y el back-fill deja 0 nulos. Verificación read-only
post-aplicación en prod: **114 encuestas intactas, 0 `instrument_version` nulas,
`NOT NULL`+`DEFAULT 1` activos, `hogar_id`/`metodo_seleccion` presentes (sync
restaurado), y la vista expone las 5 columnas nuevas**.

> **Corrección de `019`:** la primera versión reordenaba las columnas de la vista
> e insertaba las nuevas antes de `f_eta`; `create or replace view` **no** puede
> renombrar/reordenar columnas existentes (solo añadir al final), así que fallaba
> sobre la vista `004` preexistente. El test local inicial dio un falso positivo
> porque recreaba la vista desde cero. Corregido: las 19 columnas originales se
> preservan en su posición y las 5 nuevas se anexan al final. Re-validado contra
> la vista preexistente antes de aplicar.

> **Nota de orden de despliegue:** el frontend que escribe `hogar_id`/
> `metodo_seleccion` se mergeó a `main` **antes** de aplicar `018`, invirtiendo el
> orden recomendado; mientras tanto las capturas nuevas quedaban en local y
> reintentaban el sync (sin pérdida de dato). `018` restauró el sync.

### Migración 020 — back-fill heurístico de `hogar_id` en históricos

Aplicada a producción el 2026-07-22. Infiere hogares en el dato del piloto
agrupando filas con la **misma dirección + municipio normalizados** (grupos de
≥2 co-residentes; singletons quedan NULL). El id inferido lleva prefijo **`HH-`**
(vs `H-` capturado) para poder distinguirlo/excluirlo (`hogar_id like 'HH-%'`).
Resultado en prod: **38 filas en 14 hogares** (mayor = 5); 76 sin hogar. Es una
**inferencia aproximada** (riesgo de fusionar dos hogares con dirección idéntica
e incompleta): úsese con análisis de sensibilidad con/sin `HH-`. Idempotente
(solo NULL) y reversible (`update … set hogar_id=null where hogar_id like 'HH-%'`).

## Cumplimiento (Habeas Data, Ley 1581)

- Export analítico minimizado (mejores prácticas, sin restar poder analítico):
  se omite el localizador directo `dir` y se seudonimiza el identificador de
  encuestador; se conservan las variables analíticas, incluido el texto de salud
  (valor cualitativo). El texto libre (`prbSalud`, `ctoDispVc`, `obs`, «Otro»,
  `cualPunto`) pasa por `scrubFreeText`, que **redacta identificadores incidentales
  de alto riesgo** (correos → `[correo]`; secuencias de ≥6 dígitos como cédulas/
  teléfonos → `[núm]`) conservando el contenido clínico (dosis/cifras cortas, p. ej.
  presión `120/80`, se preservan). **Riesgo residual**: no detecta nombres (baja
  precisión) — para difundir a terceros, revisión humana adicional.
- El export **completo** (con PII, sin depurar) se mantiene para uso interno
  controlado, claramente rotulado.

## Pendiente / requiere tu decisión

1. ~~**ATC oficial.**~~ ✅ `atc.ts` ya **no** es un mapeo de memoria: consulta un
   diccionario DCI→ATC nivel 2 **derivado de fuente verificable y abierta** — el
   CUM de INVIMA (datos.gov.co i7cb-raxc, 157.789 filas), vía el generador
   reproducible `scripts/gen_atc_lookup.py` (`atc-cum.data.ts`, 2.761
   ingredientes). Sobre esa base hay una capa pequeña y anotada de correcciones
   (sesgo por combinado del CUM y huecos del snapshot «vigentes»), cada una con su
   ATC oficial. Cobertura del piloto ≈91% (excluye homeopáticos y marcas sin DCI,
   que quedan `SIN_CLASIFICAR`, nunca adivinados). **Nota**: el CUM no es el índice
   ATC/DDD de la OMS (no redistribuible), pero es una fuente oficial colombiana
   trazable; para uso regulatorio estricto, contrastar con WHOCC.
2. ~~**Aplicación de migraciones.**~~ ✅ `016`–`020` **aplicadas a producción**
   (2026-07-22), verificadas read-only (114 intactas, 0 versiones nulas, sync
   restaurado, vista con clúster).
3. ~~**`hogar_id` histórico.**~~ ✅ Back-filleado con la heurística `dir`+`ciudad`
   (migración `020`): 38 filas en 14 hogares, marcadas `HH-`. Es aproximado —
   analizar con sensibilidad con/sin los hogares inferidos.
4. ~~**Depuración de texto libre.**~~ ✅ El export analítico redacta identificadores
   incidentales (`scrubFreeText`: correos, cédulas/teléfonos). Queda pendiente
   **revisión humana de nombres** antes de difundir a terceros (no automatizable
   con alta precisión).
5. **Método de selección muestral** se **retiró de la captura del encuestador**
   (es una constante de estudio que fija el investigador antes de la ola, no una
   elección por encuesta). La columna `metodo_seleccion` permanece en el esquema
   para que el investigador la fije a nivel de estudio/ola. **Pendiente**: un
   mecanismo para que el investigador la establezca (config de estudio o
   `UPDATE` por ola) — se puede añadir cuando se defina.
