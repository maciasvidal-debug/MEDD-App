# MEDD · RBQM · Sección 11 — Changelog (Fase 1–2)

> Documento vivo. Registra los incrementos que habilitan los análisis de la Sección 11
> del informe **a nivel de instrumento** (la analítica en sí no vive en la app). Base
> de descubrimiento: `04-seccion11-baseline.md`.

## Estado de los cambios

| Cambio | Descripción | Estado |
|---|---|---|
| **Cambio 3** | Invariante del margen de caducidad con signo | ✅ **Implementado** (prod) |
| **Cambio 2a** | GPS + consentimiento + RLS + vista agregada | ✅ **Implementado** (prod; RLS dueño/ajeno verificada) |
| **Cambio 1b** | `aware_lookup` (tabla de referencia AWaRe) | ✅ **cargada** en prod (AWaRe **2025**, 268 + 116) |
| **Cambio 1a** | Derivación AWaRe (bridge DCI-es→AWaRe, server-side) | ✅ **Implementado** (prod; `031`) |
| **Cambio 2b** | `centro_poblado_dane` (catálogo DANE) | 🟡 **estructura en prod, seed diferido** (0 filas) · captura **diferida** (sin fricción) |

### Nota sobre los comentarios del bioestadístico (A–D)

Analizados en detalle: **A (IPW), C (κ/sensibilidad/especificidad) y D (DEff espacial)
son análisis, no captura** — el instrumento ya los habilita con el dato actual/planeado
(estrato·edad·régimen·estLab·fuente_obtencion para A; medSob·medications para C;
hogar_id + geo para D). No van en la app. Solo **B (CIE-10 / ATC nivel 5)** toca captura
y queda como decisión aparte con sus reglas de parada (fuente CIE-10 oficial; fuente
ATC5 verificable — el índice ATC/DDD de la OMS no es redistribuible). Detalle en el hilo.

---

## Comentario B — Catálogo CIE-10 oficial como tabla de referencia (`032`)

**Objetivo.** Habilitar la codificación CIE-10 del problema de salud autorreportado
(`prbSalud`, ya capturado como texto libre) contra una fuente **oficial y verificable**,
sin inventar códigos.

**Fuente (verbatim, NO de memoria).** MinSalud (Colombia), Dir. de Epidemiología y
Demografía — «Catálogo de patologías – Tabla CIE-10. Instrumentos RIPS», ed. 2018
(traducción CEMECE/WHOFIC), act. 2021-02-08 (`tabla-cie-10.zip` → hoja «Final»). Integrada
por el **script reproducible** `scripts/gen_cie10_lookup.py` (patrón de `gen_atc_lookup.py`).

**Decisión de granularidad (mínima fricción/error).** Prod recibe el catálogo a nivel de
**RÚBRICA de 3 caracteres (2.053)** — apropiado para un diagnóstico AUTORREPORTADO en hogar,
sin falsa precisión (que degradaría la κ del comentario C). El catálogo **completo de 4
caracteres (12.568 subcategorías)** queda versionado en `scripts/data/cie10_4char_full.sql`
para un eventual uso RIPS, sin aplicarlo como migración pendiente.

**Sin auto-codificación (decisión anti-error).** A diferencia de AWaRe (donde DCI→nombre es
determinista), codificar texto libre → CIE-10 NO es determinista. `cie10_sispro` sirve para
**codificación asistida con humano en el bucle** y para **validar** que un código asignado
exista — no para adivinar el código.

**Integridad.** Checksum de origen (md5 sobre `codigo|descripcion|capitulo|capitulo_nombre`
ordenado): `f277370a45ff3fda8f52c6b581f1e217` (2.053 rúbricas). Verificable contra prod tras
sembrar.

**Estado en producción.** **DDL aplicado** (tabla `cie10_sispro` + RLS de solo lectura +
índice; 0 filas). El **seed de 2.053 filas NO se pudo aplicar por MCP** (el canal trunca
payloads grandes; transcribir 2.053 filas arriesgaría corromper el dato oficial). Se
materializa por el **canal de migraciones** (`supabase db push` / psql con `SUPABASE_DB_URL`
— el mismo secret pendiente del backup): una sola configuración desbloquea seed + respaldo.

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
  **Aplicada a producción** (268 + 116 filas verificadas). **Nota de versión:** el prompt
  citaba AWaRe 2023; el stakeholder aportó la **2025** — se usa esa y se declara en la
  migración.
- **`centro_poblado_dane`** (migración `030`): catálogo DANE de centros poblados
  (**8.161** códigos, 8 díg., con municipio/departamento/tipo). **Estado en producción:
  estructura (DDL) aplicada, SEED DIFERIDO (0 filas en la base viva).** El seed de 8.161
  filas está versionado en la migración `030`; no se materializó en prod porque **no hay
  consumidor** (ver decisión de centro poblado abajo) y la asignación post-hoc de centro
  poblado requiere GEOMETRÍAS DANE (no este catálogo de atributos, que no trae
  coordenadas). Se materializa cuando exista consumidor. RLS de solo lectura.

Validados en Postgres 16 local: idempotentes; conteos correctos; `amoxicilina`
(J01CA04) → **Access** por join; centros poblados con acentos correctos.

### Decisiones cerradas (delegadas al criterio de ingeniería)

Ambas decisiones abiertas se resolvieron bajo el mandato de **mínima fricción y error**:

1. **Derivación AWaRe → server-side, sin captura nueva (opción b).** Ver «Cambio 1a»
   abajo. Se descartó el vocabulario controlado en captura (opción a) por la fricción que
   impone al encuestador y el riesgo de mala selección; el encuestador sigue digitando el
   DCI libre y la categoría se deriva por join. Cero cambio de UI.
2. **Centro poblado → captura DIFERIDA (sin campo nuevo).** El municipio (ya capturado) y
   el GPS (ya capturado, con consentimiento) cubren la geografía del análisis espacial. El
   centro poblado se asignaría post-hoc por join espacial contra **geometrías** DANE
   oficiales (que el catálogo de atributos NO trae; derivarlo del GPS exigiría fabricar
   coordenadas — vetado por la regla anti-alucinación). Añadir un combobox de centro
   poblado impondría fricción por un dato sin consumidor inmediato. Se difiere; el catálogo
   queda como estructura lista.

---

## Cambio 1a — Derivación AWaRe (Sección 11 · R9)

**Objetivo.** Pasar del principio activo CAPTURADO (texto libre en español, ruidoso:
«AMOXICILINA TRIHIDRATO (1048.97) EQUIVALENTE A AMOXICILINA») a la categoría AWaRe
(Access/Watch/Reserve), que la OMS publica en INN inglés + ATC5, para el análisis de la
Sección 11 — **sin fricción de captura y sin clasificaciones inventadas**.

**Implementado (migración `031`, server-side, sin captura nueva):**
- **`medd_dci_token(text)`**: función pura/IMMUTABLE (search_path fijo, línea de `026`)
  que extrae el token canónico del DCI (primer token alfabético, minúsculas, sin
  diacríticos). Los DCI de antibióticos encabezan con el principio activo.
- **`aware_bridge`**: puente curado **token-es → antibiótico AWaRe (INN inglés)**, con
  **FK duro a `aware_lookup(antibiotic)`** — anti-alucinación: un nombre inventado o con
  typo FALLA el insert, no entra silencioso. El puente **solo mapea nombre→nombre**; el
  ATC5 y la categoría se **leen por join** de `aware_lookup` (OMS 2025), nunca se digitan.
  Cubre los antibióticos del piloto (verificados contra el dato real) + ambulatorios
  comunes en Colombia con mapeo es→en inequívoco. Cotrimoxazol: `trimetoprim`,
  `sulfametoxazol` y `cotrimoxazol` → el MISMO combo (un producto no deriva dos ATC5).
- **`v_medicamento_aware`** (security_invoker): deriva por join, **NULL cuando el DCI no
  está cubierto o no es antibiótico** (cobertura honesta, nunca una clase arriesgada).
- **`v_qtl_aware`** (security_invoker): cobertura y distribución Access/Watch/Reserve (QTL).

**Validación (producción, dato real).** 94 ítems → **13 clasificados (11 Access, 2 Watch,
0 Reserve)**, 81 NULL (no antibióticos). Coincide con el perfil esperado del piloto
(mayoría Access; los 2 Watch = las dos grafías de ciprofloxacina/o). Sin mis-clasificación
verificada ítem a ítem: amoxicilina/ampicilina/cefalexina/clindamicina/doxiciclina/
cotrimoxazol → Access; ciprofloxacina/o → Watch. La analítica AWaRe vive fuera de la app y
consume estas vistas.

**Limitaciones documentadas.** El match usa el primer token (los combos se clasifican por
su agente base; la CATEGORÍA es correcta, el ATC5 refleja el base). `medicamento_item.
atc_codigo` no está poblado, así que el denominador de antibióticos (J01) se afina en el
análisis. Metronidazol no está en la lista antibacteriana AWaRe 2025 → NULL (correcto).
