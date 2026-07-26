# MEDD · RBQM · Sección 11 — Fase 0: Descubrimiento y línea base

> Alcance: habilitar en el **instrumento** solo lo que la Sección 11 del informe
> necesita para la próxima ola (AWaRe derivable, análisis espacial, invariante del
> margen). **Sin cambios de código en esta fase.** Verificado por lectura del repo
> (rama `claude/read-attached-prompts-c5695s`), 2026-07-26.

## 1. Cómo se captura hoy el principio activo (¿texto libre?)

**Sí, es texto libre.** `Medication.dci` se captura en `Step5.tsx` con un `<input>`
libre («Ej: Acetaminofén…»), opcionalmente prellenado por la búsqueda CUM-INVIMA
(`useCUM`), pero el encuestador puede escribir cualquier cosa. En la tabla hija
`medicamento_item` (migración 023) `principio_activo` es `text` derivado del jsonb
`dci`. **No hay vocabulario controlado ni FK** a un catálogo de principios activos.

### ¿Existe ya referencia ATC/INN verificable en el repo?

**Sí.** `src/lib/atc.ts` mapea DCI (texto ruidoso) → **ATC nivel 2** usando un
diccionario de **fuente verificable**: el CUM de INVIMA (`datos.gov.co i7cb-raxc`),
materializado en `src/lib/atc-cum.data.ts` (`ATC_LEVEL2_BY_INGREDIENT`, **2.763
ingredientes**), generado por `scripts/gen_atc_lookup.py`. Incluye extracción de
principio activo canónico (normalización de sal/combinado). **Este es el insumo
reutilizable** para el vocabulario controlado de principio activo (Cambio 1) y para
la codificación ATC diferida — ambos objetivos con una sola mejora, como pide el prompt.

**Implicación:** el catálogo `principio_activo_catalogo` puede sembrarse desde esta
fuente ya-verificable en el repo, **sin fuente externa nueva**. Lo único externo que
falta para Cambio 1 es la **tabla de referencia AWaRe** (ver §5, regla de parada).

## 2. Cómo se captura hoy la ubicación (¿coordenadas?)

- `ciudad` (municipio, canónico DANE vía `divipola.data.ts`), `departamento`
  (derivado), y `municipio_codigo` (código DANE de municipio, FK a `municipio_dane`,
  migración 022, derivado del par canónico al sincronizar).
- **NO existe** ninguna captura de **coordenadas** (lat/lng/exactitud), ni de
  **centro poblado** (la granularidad DANE es municipio, no CDCP), ni de
  **consentimiento** de geolocalización. Verificado por búsqueda global (0 resultados
  para `geo_lat|latitud|coordenad|centro_poblado|consent`).

**Implicación:** Cambio 2 (georreferenciación) es un hueco real. La parte de GPS +
consentimiento + RLS + vista desidentificada es implementable sin fuente externa. La
parte de **código DANE de centro poblado** requiere el catálogo oficial DANE de
centros poblados (CDCP), que **no está en el repo** (§5, regla de parada).

## 3. Confirmación: fecha de vencimiento y de encuesta ya cubiertas (no duplicar)

**Confirmado.** `medicamento_item.fecha_vencimiento` (date, migración 023, derivada
del jsonb `fVto`) y `surveys.f_eta` (date, fecha de la entrevista) ya existen y están
validadas en origen (constraints R7, migración 021). **Cambio 3 no añade captura**;
es una restricción sobre cómo se DERIVA y EXPONE un dato ya capturado.

## 4. Cómo se expone hoy el margen de caducidad (Cambio 3)

La vista `v_medicamento_estado` (migración 023) expone **solo** una categoría:

```sql
case
  when mi.fecha_vencimiento is null       then 'sin_fecha'
  when mi.fecha_vencimiento <  s.f_eta    then 'vencido'
  when mi.fecha_vencimiento <= s.f_eta + interval '180 days' then 'vence_6m'
  else 'vigente'
end as estado_vencimiento
```

- **NO expone el margen continuo con signo** (`fecha_vencimiento − fecha_encuesta`).
- **NO trunca en cero ni filtra los vencidos** en la vista (los incluye todos con su
  categoría), pero tampoco entrega el valor continuo que exigen los modelos correctos
  (regresión cuantílica de la mediana; MCO con varianza robusta por conglomerado).
- Nota: en el **cliente**, `buildRetention` (dashboard-metrics) sí filtra a `tVto > 0`
  y usa el signo OPUESTO (`f_eta − f_vto`) — pero es una **tarjeta descriptiva** (días
  de sobre-vencimiento), no la exposición del margen para modelado. No se toca.

**Hueco de Cambio 3:** añadir a `v_medicamento_estado` una columna
`margen_dias = fecha_vencimiento − fecha_encuesta` (con signo, sin truncar, incluyendo
vencidos), conservando `estado_vencimiento` como columna descriptiva aparte. Más un
test de invariante que falle si se pierde el signo, se truncan negativos o se excluyen
vencidos. **Sin fuente externa; implementable de inmediato.**

## 5. Fuentes externas requeridas — REGLAS DE PARADA activadas

La cláusula anti-alucinación de este prompt prohíbe generar de memoria dos insumos.
Ninguno está en el repo de fuente verificable:

1. **Lista AWaRe oficial de la OMS** (clasificación AWaRe 2023, publicación
   WHO-MHP-HPS-EML-2023.04): ~258 antibióticos con categoría Access/Watch/Reserve por
   principio activo, más la marca de formulaciones fuera del alcance sistémico
   (tópicas/oftálmicas — p. ej. neomicina, ciprofloxacino oftálmico del piloto).
   **No la aproximo.** Se requiere el archivo oficial (xlsx/csv) para sembrar
   `aware_lookup` versionada.
2. **Catálogo DANE de centros poblados (CDCP)**: el repo solo tiene municipios
   (`divipola.data.ts`). El nivel de centro poblado es un dataset oficial DANE distinto
   y mayor. **No invento códigos.** Se requiere el archivo oficial para
   `centro_poblado_dane`.

## 6. Umbrales de QTL que requieren tu criterio (regla de parada)

- **R9** (ítems antibióticos sin principio activo mapeable): el prompt sugiere «por
  ejemplo 5 %». Requiere tu confirmación.
- **R10** (registros sin geocoordenada válida): umbral a fijar; cobertura DANE
  objetivo 100 %.
- **R11** (exports con coordenada cruda de hogar): 0 % (invariante duro, no negociable).

## 7. Qué es implementable YA vs. qué espera fuente/decisión

| Ítem | ¿Fuente externa? | Estado |
|---|---|---|
| **Cambio 3** — margen con signo en `v_medicamento_estado` + test | No | Listo para implementar |
| **Cambio 1a** — `principio_activo_catalogo` (vocabulario controlado) desde INVIMA in-repo | No (in-repo) | Listo para implementar |
| **Cambio 1b** — `aware_lookup` + `aware_categoria` derivable | **Sí (OMS)** | **Bloqueado — falta archivo** |
| **Cambio 2a** — GPS (lat/lng/exactitud/ts) + consentimiento + RLS + vista desidentificada | No | Listo para implementar |
| **Cambio 2b** — `centro_poblado_dane` (FK) | **Sí (DANE CDCP)** | **Bloqueado — falta archivo** |

## Conclusión

Fase 0 completa. Dos dependencias externas disparan la regla de parada (AWaRe OMS,
DANE centro poblado) y tres umbrales de QTL requieren tu criterio. El resto (Cambio 3,
vocabulario de principio activo desde la fuente in-repo, y GPS+consentimiento+RLS) es
implementable sin aproximar nada. **Me detengo aquí y consulto antes de avanzar**, como
exige el prompt («No avances sin esto» + reglas de parada).
