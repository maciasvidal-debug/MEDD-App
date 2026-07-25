# MEDD · RBQM · Paso 1–2 — Factores críticos (CtQ) y Registro de riesgos

> Priorizado por **RPN = Probabilidad × Impacto × Detectabilidad** (FMEA).
> Escala **1–5** por factor (RPN máx. 125). **Detectabilidad alta = más difícil de
> detectar = número mayor** (más peligroso). Probabilidad e impacto son los del
> riesgo **inherente** (antes del control), sustentados en la evidencia del piloto
> (n=114). La última columna, **Estado**, es lo que distingue este registro de un
> plan en blanco: dice qué ya está controlado en el código y qué es hueco real.
>
> **Estado post-implementación (2026-07-25):** los huecos R2/R3/R4/R5/R7/R8 y PII se
> cerraron en los incrementos I1–I9 (ver `03-changelog.md`). La columna «Estado» de
> abajo refleja el diagnóstico previo a la implementación.

## Paso 1 — Factores críticos para la calidad (CtQ), confirmados con el código

| # | CtQ | Confirmado en |
|---|---|---|
| 1 | Comparabilidad entre registros (versión única) | `constants.ts`, `csv.ts:assertVersioned`, mig. `017` ✔ |
| 2 | Completitud del bloque de disposición | `validators.ts` (obligatorio si `medSob='Sí'`) ✔ parcial |
| 3 | Fidelidad de la medición (anti sesgo de información) | `startedAt`/`duracion_s` ✔ parcial (solo total) |
| 4 | Validez del dato en la entrada (fechas, unidades, rangos) | `validators.ts`, `quality.ts` (cliente); DB parcial |
| 5 | Analizabilidad del agrupamiento (`hogar_id`) | mig. `018`/`020`, `types` ✔ |
| 6 | Inventario estructurado + vencimiento automático | `Medication[]`, `date.ts`, `v_product_metrics` ✔ parcial |
| 7 | Fuente de obtención del medicamento | **NO existe** ✖ |

---

## Paso 2 — Registro de riesgos (ordenado por RPN)

| ID | Riesgo a la calidad | CtQ | P | I | D | **RPN** | Control en la fuente | QTL (límite de tolerancia) | **Estado en el repo** |
|---|---|---|---|---|---|---|---|---|---|
| **R1** | Fragmentación por versión de instrumento | 1 | 5 | 5 | 4 | **100** | Versión única activa; `instrument_version` NOT NULL sellado; export rechaza/​separa versiones | 0 % registros con versión nula o mezcla no declarada | ✅ **Implementado** (`017`, `assertVersioned`). Hueco: sellado por **trigger desde config activa** (hoy se estampa en cliente, no en DB) |
| **R2** | Sesgo de información por medición (ICC 0,27; duración predice desenlace) | 3 | 5 | 5 | 5 | **125** | Duración **por bloque**, tiempo mínimo por sección, ayudas de sondeo | % entrevistas bajo el tiempo mínimo por sección; desviación de mediana por encuestador | ⚠️ **Parcial**: solo duración total (`startedAt`). Falta duración por bloque y umbral (**regla de parada: umbral requiere tu criterio**) |
| **R3** | Incompletitud del bloque de disposición | 2 | 4 | 5 | 3 | **60** | Bloque obligatorio con `no_sabe`/`no_aplica` explícitos | Completitud del bloque ≥ 95 % | ⚠️ **Parcial**: obligatorio condicional, **sin** opciones explícitas `no_sabe`/`no_aplica` (la obligatoriedad puede forzar respuestas inventadas) |
| **R5** | Inventario semiestructurado / vencimiento manual | 6 | 4 | 4 | 3 | **48** | Captura ítem por ítem tipada; `estado_vencimiento` automático vs. fecha de encuesta; peso en gramos validado | % ítems sin fecha de vencimiento < umbral | ⚠️ **Parcial**: estructurado y con vencimiento derivado, pero **embebido (jsonb)**, no tabla hija `medicamento_item`; peso a nivel encuesta, no por ítem |
| **R6** | Falta de identificador de hogar | 5 | 4 | 4 | 3 | **48** | `hogar_id` explícito y estable; preservar `encuestador_id` | 0 % registros nuevos sin `hogar_id` | ✅ **Implementado** (`018` captura; `020` back-fill heurístico `HH-`). Históricos singleton = NULL por diseño |
| **R8** | Ausencia de fuente de obtención | 7 | 5 | 4 | 2 | **40** | Nueva variable, catálogo cerrado NOT NULL (EPS/IPS, compra fraccionada, muestra médica, donación, otro) | Completitud ≥ 95 % | ✖ **Hueco real**: no existe. Bloquea contrastar la hipótesis mejor sustentada (trabajador independiente, PR aj. 0,62) |
| **R7** | Errores de fecha y rango | 4 | 3 | 4 | 3 | **36** | Validación en origen: `f_eta` en ventana no futura, `f_nac ≤ f_eta`, edad 0–110, cantidades enteras, peso > 0 | 0 % registros que superen los rangos | ⚠️ **Parcial**: validado **en cliente**; **sin CHECK en DB** (la última línea de defensa falta) |
| **R4** | Texto libre no normalizado | 4 | 3 | 2 | 2 | **24** | Catálogos cerrados (municipios DANE, disposición, motivo) + regla «Otro» | % uso de «Otro» por campo < 10 % | ⚠️ **Parcial**: canonicalización DANE **en cliente** (`divipola.data.ts`), `departamento` derivado; **sin tabla `municipio_dane` + FK** ni CHECK de «Otro» en DB |

### Notas de calibración (justificación de P/I/D)

- **R2 = RPN 125 (máximo).** Detectabilidad 5: el sesgo de información es **silencioso**
  en el dato — no hay valor «fuera de rango» que lo delate; solo se infiere con
  para-data por bloque que hoy no se captura. Es el riesgo residual más alto **aunque**
  R1 esté cerrado.
- **R1 = 100.** Fue el defecto **dominante y observado** (105/114 versión nula), pero
  su control ya está en producción; el RPN refleja el riesgo inherente para justificar
  el monitoreo continuo (QTL vigilable desde la primera fila de la próxima ola).
- **R8 detectabilidad 2:** la ausencia total es trivial de detectar, pero el **impacto
  4** (hipótesis central no contrastable) lo mantiene por encima de R7/R4.

### Prioridad de implementación (post-aprobación)

Coherente con el prompt (R1/R2/R3 sobre ATC) y con lo ya hecho:

1. **R2** — para-data por bloque (dato) + tiempo mínimo/sondeo (interfaz). *Requiere tu umbral.*
2. **R3** — enums `no_sabe`/`no_aplica` en el bloque de disposición.
3. **R8** — `fuente_obtencion` (variable nueva, catálogo cerrado).
4. **R7** — subir las validaciones de rango del cliente al **esquema** (CHECK en DB).
5. **R5** — evaluar tabla hija `medicamento_item` (**cambio de modelo de datos → regla de parada**).
6. **R4** — tabla `municipio_dane` + FK + CHECK «Otro» (llevar catálogo a DB).
7. **R1/R6** — endurecer con trigger de sellado (R1) — refinamientos, ya operativos.

> R1, R6 y (parcialmente) R4/R5 **ya cumplen su QTL hoy**. El esfuerzo nuevo se
> concentra en R2, R3, R8 y en bajar R7/R4 al esquema.
