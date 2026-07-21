# MEDD — Auditoría del piloto · Fase 1: Análisis de brechas

> Metodología **DMAIC** por recomendación de la Sección 7. «Estado actual» está
> anclado a código; «Brecha» es solo lo genuinamente faltante (el resto ya está
> implementado — ver `00-baseline.md`). **No se implementa nada en esta fase.**
>
> **Convención de severidad de la brecha:** 🔴 alta · 🟠 media · 🟢 baja/ninguna.

---

## Tabla resumen

| # | Recomendación (Sec. 7) | Estado actual (evidencia) | Brecha | Cambio propuesto | Riesgo / impacto en datos históricos |
|---|---|---|---|---|---|
| 1 | Instrumento único y versionado controlado | `INSTRUMENT_VERSION=2` estampado en captura (`store.ts:359`); mapeado (`sync-mapping.ts:55,110`) y exportado (`csv.ts:24`). Semántica NULL≡v1. | 🟠 `instrument_version` **sin NOT NULL**; **sin back-fill** que fije `=1` en históricos; **export no bloquea** versión nula ni mezcla. Sin test que lo impida. | (a) Back-fill idempotente `instrument_version=1 WHERE NULL` + `DEFAULT 1` + `NOT NULL`. (b) Estampar `1` en lectura de registros locales sin versión. (c) Guarda de export: rechazar/separar versión nula o mezclada. (d) Tests de regresión. | Bajo. Back-fill solo toca NULLs (v1 por definición). Reversible (`DROP DEFAULT`, `ALTER … DROP NOT NULL`). Escribir siempre v1 en históricos es semánticamente correcto. |
| 2 | Campos obligatorios y validaciones en captura | Requeridos: `fEta`,`nuiEtr`,`fNac`,`ciudad`,`departamento`,`etnia`,`asSalud`,`estLab`,`ingreso`,`nvEstu`,`perSalud`,`estSalud`,`medSob` (`validators.ts`). Cruces `fNac≤fEta`, `fDisp≤fEta`, `cantMedVto≤cantMed`, «vencido sin detalle» = **error bloqueante** (`quality.ts:55`). Edad 0–110 y peso>5000g = **warning**. Peso declarado en **gramos** (`CODEBOOK`). | 🟠 (i) `fEta` solo valida **formato**, no **rango plausible** (2012 pasaría — defecto del piloto). (ii) Bloque de disposición **no obligatorio**: `dispMedVc`, `vtoMedNc` son `siNo` sin `.refine`. (iii) Edad fuera de 0–110 es warning, no bloqueo. | (a) `fEta` con rango `[STUDY_START, hoy]` (constante configurable; propongo `2024-01-01`) en Zod. (b) Hacer obligatorio el bloque de disposición cuando aplique (`medSob='Sí'`). (c) Edad implausible → error bloqueante. | Bajo (solo captura nueva). **No** re-valida históricos (no se re-escriben). Definir `STUDY_START` es decisión tuya (ver reglas de parada). |
| 3 | Catálogos cerrados | Catálogo **DANE/DIVIPOLA** offline (1.122 municipios, `divipola.data.ts`, verificado 1:1 en test); `departamento` derivado y **obligatorio** (`validators.ts:54`); canonicalización de `ciudad` histórica (`ciudad.ts`); disposición/motivos con enums cerrados + «Otro» condicional (`constants.ts`, `step4Refine`). | 🟠 **Deriva de esquema**: `sync-mapping.ts:64` escribe `departamento` a Supabase pero **ninguna migración crea la columna** `departamento` (búsqueda global: 0 resultados en `supabase/migrations/`). El upsert dependería de una columna añadida a mano y no versionada. | Migración idempotente `add column if not exists departamento text` + índice opcional + comentario. (Rec. de catálogo en sí: **ya cumplida**.) | Bajo. Aditiva y nullable. Alinea código y esquema; **cierra un riesgo real de fallo de sync** en un entorno limpio. |
| 4 | Codificación de medicamentos + vencimiento automático | Inventario **estructurado** (`Medication{nmMed,dci,concMed,undConc,fVto}`), capturado en `Step5` (no texto libre). Vencimiento derivado en analítica: `productMetrics().isExpired` (`date.ts:45`) y `is_expired` en la vista SQL (`001_initial.sql:109`). ATC nivel 1/2 en `atc.ts`. | 🔴 **ATC hecho «de memoria»**: `atc.ts` es una tabla `RULES` de códigos ATC escrita a mano, **sin fuente verificable** — choca con la cláusula anti-alucinación. 🟢 `estado_vencimiento` se deriva al leer, **no se persiste** como campo en captura/almacenamiento (la vista lo cubre; persistirlo es opcional). | ATC: **detenerse y preguntar** por fuente verificable (ver reglas de parada) antes de tocar. Opcional: exportar `estado_vencimiento` por producto en el CSV (derivado determinista, sin migración) para dejar el denominador listo. | ATC: alto si se «arregla» sin fuente (riesgo de códigos inventados). Exponer estado de vencimiento en export: nulo (derivado, no altera almacenamiento). |
| 5 | Identificador de hogar y diseño muestral | `nuiEtr` (encuestador) preservado y estampado. `data_env`, `backcheck_of`, `started_at` presentes. | 🔴 **No existe `hogar_id`** ni ningún campo de **método de selección muestral** (búsqueda global: 0 resultados). El agrupamiento por hogar (ICC≈0,27) hoy **no es modelable** desde el dato. | (a) Añadir `hogar_id` (texto/UUID estable) al tipo, captura, esquema y export. (b) Campo(s) de método de selección (enum cerrado: p. ej. aleatorio simple / sistemático / conveniencia). (c) Preservar `nuiEtr` como clúster de encuestador (ya está). (d) Back-fill de `hogar_id` para históricos **solo si hay evidencia** (misma `dir`+`ciudad`); si no, dejar NULL y documentarlo. | Medio. El back-fill por `dir`+`ciudad` es **heurístico**: riesgo de agrupar de más/menos. Debe ser **conservador y reversible** y **no** debe fusionar registros. Decisión tuya sobre la regla de agrupamiento (regla de parada si pudiera alterar la interpretación). |
| 6 | Soporte a tamaño/potencia (export limpio + nota de método) | Export lleva `instrumentVersion`, `nuiEtr` (clúster), `data_env`; denominadores calculables. | 🟠 (i) Sin `hogar_id` el clúster-hogar no es identificable (depende de Rec. 5). (ii) **PII en export analítico** (`dir`, `prbSalud`, `ctoDispVc`) sin minimización — decisión de cumplimiento. (iii) Falta **nota de método** para n objetivo. | (a) Entregar `docs/medd-audit/sample-size-note.md` (prevalencia `medSob≈0,79`, precisión, efecto de diseño con ICC≈0,27). (b) Proponer política PII de export (seudonimizar/omitir texto libre sensible en el export analítico) — **requiere tu decisión**. | Nota de método: nulo. Política PII: **regla de parada** (no hay política definida en el repo). |

---

## Detalle DMAIC por recomendación

### Rec. 1 — Versionado controlado 🟠
- **Definir:** un export puede mezclar registros v2 con registros de versión
  nula (v1) sin barrera; el defecto dominante del piloto (105/114 nulos) puede
  repetirse en analítica.
- **Medir:** hoy `instrument_version` es nullable (`013_add_motives.sql`), sin
  back-fill; `toCSV` no filtra ni marca. 0 tests que lo impidan.
- **Analizar (causa raíz):** la columna se introdujo aditiva y nullable (correcto
  para no romper sync), pero **nunca se cerró el ciclo**: ni back-fill, ni
  restricción, ni guarda de export.
- **Mejorar (propuesto):** back-fill idempotente + `DEFAULT 1` + `NOT NULL`;
  normalizar a `1` al leer registros locales sin versión (`fromRow`/carga IDB);
  guarda en `toCSV` que **rechace** versión nula (o exporte por versión declarada).
- **Controlar (test):** test que falle si `toCSV` acepta un `Survey` con
  `instrumentVersion` nulo o si mezcla versiones sin declararlas.

### Rec. 2 — Validaciones en captura 🟠
- **Causa raíz del `fEta=2012`:** `step1Schema` valida `YYYY-MM-DD` pero no rango.
  Las plausibilidades de edad/peso viven en `quality.ts` como **warnings** (post),
  no como bloqueo en el instrumento → contradice «Quality by Design».
- **Mejora:** rango de `fEta` en Zod; obligatoriedad condicional del bloque de
  disposición; edad implausible como error. **Sin** re-validar históricos.

### Rec. 3 — Catálogos + deriva de esquema `departamento` 🟠
- La recomendación de catálogos **ya está cumplida**. La brecha es de **5S /
  trazabilidad**: el cliente escribe una columna que las migraciones no crean.
  En un proyecto Supabase reconstruido desde `migrations/`, el sync **fallaría**.
- **Mejora:** migración aditiva idempotente para `departamento`.

### Rec. 4 — ATC (regla de parada) 🔴 + vencimiento 🟢
- `atc.ts` mapea DCI→ATC con una tabla escrita a mano. Es determinista y bien
  testeada, **pero su fuente es conocimiento del autor, no un diccionario
  verificable**. La cláusula anti-alucinación prohíbe generar/ampliar códigos ATC
  de memoria. **No se tocará ATC hasta acordar una fuente** (ver reglas de parada).
- Vencimiento: ya se deriva (código y SQL). Persistirlo/exportarlo es opcional.

### Rec. 5 — Hogar y diseño muestral 🔴 (mayor brecha de implementación)
- No hay `hogar_id` ni método de selección. Es la brecha central que impide
  modelar el agrupamiento detectado.
- El back-fill histórico de `hogar_id` es **heurístico** y toca interpretación
  del dato → **conservador, reversible, y con tu visto bueno** de la regla.

### Rec. 6 — Tamaño muestral + PII 🟠
- Nota de método: entregable documental (sin código).
- PII en export analítico: **no hay política en el repo** → regla de parada.

---

## Reglas de parada activadas (requieren tu decisión antes de la Fase 2/3)

1. **El esquema real difiere del informe de forma que cambia el plan.** La mayoría
   de las seis recomendaciones ya están implementadas. Propongo **reducir el
   alcance de implementación** a: Rec. 1 (enforcement+back-fill+guarda),
   Rec. 2 (validaciones de captura), Rec. 3 (migración `departamento`),
   Rec. 5 (`hogar_id`+diseño muestral), Rec. 6 (nota de método). **¿Apruebas este
   recorte de alcance?**
2. **ATC sin fuente verificable.** ¿Integramos un diccionario ATC versionado
   (fuente + licencia a definir) o **dejamos `atc.ts` como está** y no ampliamos
   códigos? Hasta tu decisión, **no se toca ATC**.
3. **CSV histórico ausente.** El regresión-test de Fase 4 exige cargar
   `MEDD_2026-07-21.csv`, que **no está en el repo**. ¿Puedes aportarlo (idealmente
   anonimizado) o autorizas un **fixture sintético representativo** que reproduzca
   el formato y los defectos conocidos?
4. **Back-fill de `hogar_id`.** ¿Autorizas la heurística `dir`+`ciudad` (misma
   dirección normalizada ⇒ mismo hogar), sabiendo que es aproximada, o prefieres
   dejar `hogar_id` **NULL en históricos** y poblarlo solo desde la próxima ola?
5. **Política PII de export.** No hay política en el repo. ¿Minimizamos el export
   analítico (omitir/seudonimizar `dir`, `prbSalud`, `ctoDispVc`) o lo dejamos y
   solo lo documentamos? (Habeas Data, Ley 1581.)

**Detengo aquí la implementación y espero tu aprobación del plan.**
