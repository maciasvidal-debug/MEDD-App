# MEDD · RBQM · Sección 11 — Changelog (Fase 1–2)

> Documento vivo. Registra los incrementos que habilitan los análisis de la Sección 11
> del informe **a nivel de instrumento** (la analítica en sí no vive en la app). Base
> de descubrimiento: `04-seccion11-baseline.md`.

## Estado de los cambios

| Cambio | Descripción | Estado |
|---|---|---|
| **Cambio 3** | Invariante del margen de caducidad con signo | ✅ **Implementado** |
| **Cambio 2a** | GPS + consentimiento + RLS + vista agregada | ✅ **Implementado** |
| **Cambio 1b** | `aware_lookup` (tabla de referencia AWaRe) | ✅ **cargada** (AWaRe **2025**) · derivación pendiente de decisión |
| **Cambio 2b** | `centro_poblado_dane` (catálogo DANE) | ✅ **cargado** (8.161) · captura pendiente de decisión |
| **Cambio 1a** | Vocabulario controlado / bridge DCI→ATC5 | ⏸️ decisión abierta (regla de parada: mapeo fiable) |

### Nota sobre los comentarios del bioestadístico (A–D)

Analizados en detalle: **A (IPW), C (κ/sensibilidad/especificidad) y D (DEff espacial)
son análisis, no captura** — el instrumento ya los habilita con el dato actual/planeado
(estrato·edad·régimen·estLab·fuente_obtencion para A; medSob·medications para C;
hogar_id + geo para D). No van en la app. Solo **B (CIE-10 / ATC nivel 5)** toca captura
y queda como decisión aparte con sus reglas de parada (fuente CIE-10 oficial; fuente
ATC5 verificable — el índice ATC/DDD de la OMS no es redistribuible). Detalle en el hilo.

---

## Cambio 3 — Margen de caducidad con signo (Sección 11.2)

**Objetivo.** Garantizar que el análisis del margen reciba el valor CRUDO CON SIGNO, sin
transformaciones que impidan la especificación correcta (regresión cuantílica de la
mediana como primaria; MCO con varianza robusta por conglomerado como sensibilidad).

**Implementado (sin captura nueva):**
- **`v_medicamento_estado` + `margen_dias`** (migración `027`): columna continua
  `fecha_vencimiento − fecha_encuesta` (días, con signo), **anexada al final** de la
  vista `023` (`create or replace view` no reordena columnas — misma lección que `019`).
  NULL si falta fecha; **negativo si ya estaba vencido** (incluido, no excluido, no
  truncado, sin desplazamiento). `estado_vencimiento` se conserva como columna descriptiva
  aparte, no la reemplaza.
- **`margenDias(fEta, fVto)`** (`src/lib/date.ts`): función pura equivalente para el
  cliente/derivaciones, con el mismo invariante.
- **Test de invariante** (`src/lib/date.test.ts`, +6): **falla si** se pierde el signo,
  se trunca el negativo en cero, se excluye el ítem vencido (null), o se aplica un
  desplazamiento por constante. Incluye la frontera (0 el día exacto) y la relación
  `margen = −tVto`.

**Validación.** Migración aplicada en Postgres 16 local sobre la vista `023` preexistente:
`create or replace` limpio e idempotente (2ª pasada sin efecto); `margen_dias` = −485
(vencido, con signo), 356 (vigente), NULL (sin fecha). **399 tests en verde**, tsc + build
+ lint OK.

**Pendiente de aplicar a producción:** la migración `027` no se ha aplicado a la base viva
(a la espera del visto bueno, como con `021`–`026`). Es aditiva (solo añade una columna a
una vista `security_invoker`), sin tocar datos.

---

## Cambio 2a — Georreferenciación (Sección 11 · R10/R11)

**Objetivo.** Habilitar el análisis espacial (Moran/LISA, patrón de puntos) de la ola
grande y separar el patrón territorial del efecto de encuestador, sin exponer la
ubicación exacta del hogar como PII (Ley 1581).

**Implementado:**
- **`survey_geo`** (migración `028`): tabla PROPIA con lat/lng/exactitud/timestamp y
  **RLS de SOLO DUEÑO** — únicamente el encuestador que capturó accede a su geo; el rol
  analítico (investigador) NO. La coordenada cruda nunca llega al panel ni al export.
  CHECK de rango de coordenadas. `surveys.geo_consent` (bandera NO sensible) para QC de
  cobertura.
- **Captura en la app** (`Step2`): consentimiento explícito (checkbox) + botón GPS
  (`navigator.geolocation`, alta exactitud, no bloqueante); sin consentimiento o con
  fallo del GPS → sin coordenada, sin bloquear la encuesta.
- **Sync WRITE-ONLY** (`sync.ts:pushSurveyGeo`): el cliente sube su geo a `survey_geo`
  (best-effort, solo encuestador, solo con consentimiento+coordenada) y **nunca la baja**
  — la coordenada cruda no circula. El análisis de puntos lo hace un rol privilegiado
  fuera de la app.
- **Vista analítica agregada** `v_geo_municipio`: conteos por municipio (DANE) + cobertura
  de consentimiento, **sin coordenada cruda**. Monitoreo `v_qtl_geo` (R10).
- **Invariante R11** (`csv.test.ts`): test que **falla si** el export (completo o
  analítico) contiene la coordenada cruda del hogar. `sync-mapping`: la coordenada NO
  viaja a la fila `surveys` (solo la bandera), verificado por test.

**Validación.** Migración `028` en Postgres 16 local: idempotente; CHECK rechaza lat 200;
la vista agregada tiene **0** columnas de coordenada. RLS owner-only (patrón idéntico al
validado en prod para `medicamento_item`); se verificará con test dueño/ajeno al aplicar a
prod. **401 tests en verde**, tsc + build + lint OK.

**Pendiente:** `028` por aplicar a producción (con tu visto bueno).

---

## Catálogos de referencia oficiales cargados (Cambios 1b y 2b)

El stakeholder aportó las fuentes oficiales; se integran **verbatim** (sin inventar):

- **`aware_lookup`** (migración `029`): clasificación **AWaRe OMS 2025** (WHO B09489) —
  268 antibióticos (93 Access · 145 Watch · 30 Reserve) con su ATC5, + 116
  combinaciones «no recomendadas» (`aware_not_recommended`). RLS de solo lectura.
  **Nota de versión:** el prompt citaba AWaRe 2023; el stakeholder aportó la **2025**
  (más reciente) — se usa esa y se declara en la migración.
- **`centro_poblado_dane`** (migración `030`): catálogo DANE de centros poblados —
  **8.161** códigos (8 díg.) con municipio/departamento/tipo. RLS de solo lectura.

Validados en Postgres 16 local: idempotentes; conteos correctos; `amoxicilina`
(J01CA04) → **Access** por join; centros poblados con acentos correctos. **Migraciones
`029`/`030` por aplicar a producción** (seeds grandes; se aplican con tu visto bueno).

### Decisiones abiertas (regla de parada)

1. **Derivación de `aware_categoria` (bridge DCI→ATC5).** La captura del principio
   activo es texto libre en español y ruidoso (p. ej. «AMOXICILINA TRIHIDRATO (1048.97)
   EQUIVALENTE A AMOXICILINA»); la AWaRe está en INN inglés + ATC5. Mapear requiere un
   bridge (criterio). Control cruzado del piloto contra AWaRe 2021: ~11 antibióticos
   mapeados (≈9 Access, 2 Watch) — consistente con el 12/2/1 esperado, con normalizador
   aproximado. **Opciones:** (a) vocabulario controlado en captura (el encuestador elige
   de una lista pre-mapeada a ATC5) — mejor a futuro; (b) bridge curado DCI-es→ATC5 para
   los antibióticos conocidos, validado contra el 12/2/1. Requiere tu decisión.
2. **Captura de centro poblado.** ¿Combobox de centro poblado acotado al municipio
   (como el de municipio), o derivar el centro poblado de la coordenada GPS post-hoc?
