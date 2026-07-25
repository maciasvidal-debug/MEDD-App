# MEDD · RBQM · Fase 2 — Backlog incremental (Scrum), ordenado por RPN

> Aprobado por el stakeholder el **2026-07-25**. Alcance: **llenar los huecos reales**
> sin tocar lo que ya funciona en producción (R1, R6, y las partes ya cumplidas de
> R4/R5). Cada incremento es verificable en aislamiento, con criterios de aceptación
> y pruebas que **fallan si el defecto reaparece**.

## Decisiones del stakeholder que fijan el diseño

1. **Alcance:** solo huecos reales; no rehacer lo aplicado a producción.
2. **R2 (umbral):** mediana de referencia **474 s para inventario de 1 ítem**. De ahí
   se deriva el modelo `E(ítems) = 474 + 39·(ítems−1)`; la pendiente **≈ 39 s/ítem**
   se estimó por **regresión robusta (Theil-Sen)** sobre el CSV real (n=100
   entrevistas con para-data, excluidos outliers > 1 h de «app abierta»). Piso de
   «apresurada» = **50 % de la esperada** (regla conservadora estándar, configurable).
3. **R5 — inventario:** **tabla hija `medicamento_item`** (mejor práctica de ingeniería
   y farmacoepidemiología: grano por fármaco, integridad referencial, `atc_codigo` y
   `fuente_obtencion` por ítem, vencimiento por ítem).
4. **R4 — municipios:** **catálogo DANE en la base** (`municipio_dane`) con integridad
   referencial, además de la canonicalización en cliente ya existente.
5. **PII/RLS:** **la opción más robusta** — RLS + **vista analítica SQL desidentificada**
   separada de la operativa (el esquema como última línea de defensa).
6. **Respaldo:** autorizado — GitHub Action de respaldo periódico a Storage.
7. **CSV histórico real:** aportado. Se usa localmente para el test de regresión; **no
   se versiona crudo** (PII) — se deriva un fixture anonimizado.

### Decisión de farmacoepidemiología: `fuente_obtencion` por medicamento

El anexo plantea `fuente_obtencion` como columna de la encuesta. Se implementa a nivel
**de cada medicamento** (`medicamento_item.fuente_obtencion`), porque un hogar obtiene
distintos fármacos por distintas vías; el grano por ítem es el correcto para contrastar
la hipótesis del trabajador independiente (acceso por dispensación institucional vs.
compra fraccionada). Se **bumpea `INSTRUMENT_VERSION` a 3** (disciplina de versionado
R1: se añaden variables a mitad de estudio; los ítems históricos quedan con
`fuente_obtencion` NULL = «no preguntado», separable por versión).

---

## Incrementos (por RPN)

| # | Riesgo | Incremento | Archivos clave | Migración | Estado |
|---|---|---|---|---|---|
| I1 | R7 (36) | Constraints de rango en el esquema (fecha, edad) — última línea de defensa | `021_range_checks.sql` | 021 | ✅ |
| I2 | R2 (125) | Modelo de tiempo (`interview-timing.ts`) + para-data por bloque + monitoreo | `interview-timing.ts`, wizard, `022` | 022 | 🚧 |
| I3 | R3 (60) | Opciones explícitas `No sabe` / `No aplica` en el bloque de disposición | `constants.ts`, `validators.ts`, `Step4.tsx` | — | 🚧 |
| I4 | R8 (40) | `fuenteObtencion` por medicamento (catálogo cerrado) + versión 3 | `types`, `constants`, `Step5.tsx`, `sync-mapping`, `csv`, `023` | 023 | 🚧 |
| I5 | R4 (24) | Tabla `municipio_dane` + FK `municipio_codigo` + CHECK «Otro» | `024_*.sql`, seed DANE | 024 | 🚧 |
| I6 | R5 (48) | Tabla hija `medicamento_item` + vista `v_medicamento_estado` (dual-write en sync) | `025_*.sql`, `sync.ts` | 025 | 🚧 |
| I7 | PII | RLS por sensibilidad + vista analítica SQL desidentificada | `026_*.sql` | 026 | 🚧 |
| I8 | Cont. | GitHub Action de respaldo a Supabase Storage (idempotente, versionada) | `.github/workflows/supabase-backup.yml` | — | 🚧 |
| I9 | Verif. | Fixture real anonimizado + vistas `v_qtl_*` + test de regresión + changelog | `027_*.sql`, `csv-import.test.ts`, `03-changelog.md` | 027 | 🚧 |

> **Nota de secuencia:** R1/R6 no aparecen: sus QTL ya se cumplen en producción. El
> refinamiento de R1 (trigger de sellado de versión desde config activa) se evalúa en
> I9 como endurecimiento opcional, no como hueco.

## Reglas de parada que siguen vigentes

- El **piso del 50 %** de R2 y la **fecha mínima de estudio (2024-01-01)** son criterios
  configurables; se implementan como constantes documentadas, no como valores ocultos.
- Cualquier migración que pudiera **rechazar un registro del piloto** se aplica como
  `NOT VALID` (constraints) o solo sobre escrituras nuevas (triggers), preservando el
  dato histórico crudo (p. ej. el registro con `fEta=2012`).
