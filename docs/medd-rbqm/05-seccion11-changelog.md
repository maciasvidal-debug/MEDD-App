# MEDD · RBQM · Sección 11 — Changelog (Fase 1–2)

> Documento vivo. Registra los incrementos que habilitan los análisis de la Sección 11
> del informe **a nivel de instrumento** (la analítica en sí no vive en la app). Base
> de descubrimiento: `04-seccion11-baseline.md`.

## Estado de los cambios

| Cambio | Descripción | Estado |
|---|---|---|
| **Cambio 3** | Invariante del margen de caducidad con signo | ✅ **Implementado** |
| **Cambio 2a** | GPS + consentimiento + RLS + vista desidentificada | 🚧 en curso |
| **Cambio 2b** | Código DANE de centro poblado | ⛔ bloqueado (falta archivo DANE CDCP) |
| **Cambio 1a** | Vocabulario controlado de principio activo | ⏸️ diferido (se empareja con AWaRe) |
| **Cambio 1b** | `aware_lookup` + `aware_categoria` derivable | ⛔ bloqueado (falta archivo OMS AWaRe 2023) |

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

## Cambio 2a — Georreferenciación (en curso)

En el siguiente incremento: captura GPS del hogar (lat/lng/exactitud/timestamp) **solo con
consentimiento explícito**, aislada como dato sensible (tabla propia con RLS de dueño),
vista analítica que **no** expone la coordenada cruda (R11 = 0 % en el export analítico),
y consultas de monitoreo R10/R11. El código DANE de centro poblado (Cambio 2b) queda
pendiente del archivo oficial DANE.
