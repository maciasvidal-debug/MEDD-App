# MEDD · RBQM · Paso 3 — Plan de control y monitoreo

> Traduce cada **QTL** del registro de riesgos en una **consulta ejecutable** sobre
> el dato capturado, con umbral de alarma, acción de escalamiento y cadencia. El
> monitoreo se concentra en lo crítico: **R1, R2, R3** (revisión frecuente); el resto
> se vigila por excepción.
>
> **Nota:** las consultas usan los nombres reales del esquema Supabase
> (`public.surveys`). Las que dependen de controles aún no implementados (R2 por
> bloque, R8) se marcan **[pendiente de implementación]** y quedan listas para activarse
> tras la aprobación. Ejecutar como rol **investigador** (RLS).

---

## Tablero de control (resumen)

| QTL | Umbral de alarma | Cadencia | Escalamiento |
|---|---|---|---|
| R1 · versión nula/mezcla | **> 0 %** nulas | Cada carga de export + diario en ola | Bloquear export; revisar cliente desactualizado |
| R2 · entrevistas apresuradas | **> 10 %** bajo mínimo, o encuestador con mediana < 60 % del global | Diario en ola | Re-entrenar/​back-check al encuestador; auditar sus registros |
| R3 · completitud disposición | **< 95 %** con `medSob='Sí'` | Diario en ola | Revisar instrumento/​flujo del encuestador |
| R4 · uso de «Otro» | **> 10 %** por campo | Semanal | Revisar/​ampliar catálogo |
| R5 · ítems sin vencimiento | **> 20 %** de ítems | Semanal | Refuerzo de captura de `fVto` |
| R6 · sin `hogar_id` | **> 0 %** capturas nuevas | Diario en ola | Revisar flujo de captura |
| R7 · fuera de rango | **> 0 %** | Cada carga (bloqueado en DB tras R7) | Corregir en origen |
| R8 · completitud fuente | **< 95 %** | Diario en ola | Revisar instrumento |

Cadencia alineada con Scrum: **diaria** durante la ola de recolección (R1/R2/R3/R6/R8),
**semanal** en la revisión de incremento (R4/R5), y **por evento** en cada generación
de export (R1/R7).

---

## Consultas de monitoreo (QTL → SQL)

### R1 — Versión: 0 % nulas, sin mezcla no declarada

```sql
-- Alarma si nulas > 0 (QTL: 0 %). Distribución por versión para separar denominadores.
select
  count(*)                                            as n,
  count(*) filter (where instrument_version is null)  as n_version_nula,
  round(100.0 * count(*) filter (where instrument_version is null) / nullif(count(*),0), 2) as pct_nula,
  jsonb_object_agg(coalesce(instrument_version::text,'NULL'), c) as por_version
from (
  select instrument_version, count(*) c
  from public.surveys where data_env = 'prod'
  group by instrument_version
) t, public.surveys s
where s.data_env = 'prod'
group by ();
```
*La barrera de export `assertVersioned` (cliente) ya impide emitir nulas; esta consulta
vigila el dato **en reposo**.*

### R2 — Fidelidad de la medición  *[duración por bloque: pendiente de implementación]*

```sql
-- (a) Con duración TOTAL (disponible hoy): desviación de la mediana por encuestador.
with d as (
  select nui_etr,
         extract(epoch from (updated_at - started_at)) as dur_s
  from public.surveys
  where data_env = 'prod' and started_at is not null
)
select nui_etr,
       count(*)                       as n,
       percentile_cont(0.5) within group (order by dur_s) as mediana_s,
       (select percentile_cont(0.5) within group (order by dur_s) from d) as mediana_global_s
from d group by nui_etr
order by mediana_s;
-- Alarma: encuestador con mediana < 60 % de la global (umbral SUJETO A TU CRITERIO).

-- (b) [pendiente] Con duración por bloque, medir % de secciones bajo el tiempo mínimo:
-- select ... where dur_bloque_s < :min_seg_bloque  -- :min_seg_bloque REQUIERE tu umbral.
```
> **Regla de parada activa:** el tiempo mínimo por sección y el «60 % de la mediana»
> son umbrales de criterio; no se derivan del dato sin tu confirmación.

### R3 — Completitud del bloque de disposición ≥ 95 %

```sql
-- Denominador = encuestas con medicamentos sobrantes (medSob='Sí'), donde el bloque aplica.
select
  count(*)                                                          as n_aplica,
  count(*) filter (where disp_med_vc is not null
                     and vto_med_nc is not null)                    as n_completo,
  round(100.0 * count(*) filter (where disp_med_vc is not null
                     and vto_med_nc is not null) / nullif(count(*),0), 2) as pct_completo
from public.surveys
where data_env = 'prod' and med_sob = 'Sí' and instrument_version >= 2;
-- Alarma: pct_completo < 95 %.
```

### R4 — Uso de «Otro» por campo < 10 %

```sql
select
  round(100.0 * count(*) filter (where 'Otro' = any(disp_final))  / nullif(count(*),0), 2) as pct_disp_otro,
  round(100.0 * count(*) filter (where 'Otro' = any(mot_venc))    / nullif(count(*),0), 2) as pct_motvenc_otro
from public.surveys
where data_env = 'prod' and instrument_version >= 2;
-- Alarma: cualquier pct > 10 % ⇒ el catálogo necesita revisión.
```

### R5 — Ítems sin fecha de vencimiento < 20 %

```sql
-- medications es jsonb (arreglo de productos). Se expande por ítem.
select
  count(*)                                                as n_items,
  count(*) filter (where (m->>'fVto') is null
                      or (m->>'fVto') = '')               as n_sin_vto,
  round(100.0 * count(*) filter (where (m->>'fVto') is null
                      or (m->>'fVto') = '') / nullif(count(*),0), 2) as pct_sin_vto
from public.surveys s
cross join lateral jsonb_array_elements(coalesce(s.medications,'[]'::jsonb)) m
where s.data_env = 'prod';
-- Alarma: pct_sin_vto > 20 %.
```

### R6 — `hogar_id` en capturas nuevas: 0 % nulo

```sql
-- Solo capturas nuevas (excluye piloto histórico e inferidos HH-).
select
  count(*)                                                as n,
  count(*) filter (where hogar_id is null or hogar_id='') as n_sin_hogar
from public.surveys
where data_env = 'prod' and instrument_version >= 2
  and (hogar_id not like 'HH-%' or hogar_id is null);
-- Alarma: n_sin_hogar > 0.
```

### R7 — Fuera de rango: 0 %  *(hoy consulta; tras implementación, bloqueado por CHECK en DB)*

```sql
select
  count(*) filter (where f_eta > current_date)                                      as fecha_futura,
  count(*) filter (where f_eta < date '2024-01-01')                                 as fecha_previa_estudio,
  count(*) filter (where f_nac > f_eta)                                             as nac_posterior_entrevista,
  count(*) filter (where extract(year from age(f_eta, f_nac)) not between 0 and 110) as edad_implausible,
  count(*) filter (where peso_med_nc is not null and peso_med_nc <= 0)              as peso_no_positivo
from public.surveys where data_env = 'prod';
-- Alarma: cualquier columna > 0. (STUDY_START = 2024-01-01 confirmado en constants.ts.)
```

### R8 — Completitud de fuente de obtención ≥ 95 %  *[pendiente de implementación]*

```sql
-- [pendiente] Requiere la columna fuente_obtencion (R8 no implementado).
-- select round(100.0 * count(*) filter (where fuente_obtencion is not null)
--   / nullif(count(*),0), 2) as pct_completo
-- from public.surveys where data_env='prod' and med_sob='Sí' and instrument_version >= 3;
```

---

## Operacionalización

- **Dónde viven:** estas consultas deben quedar como **vistas de monitoreo** (`v_qtl_*`)
  en una migración `security_invoker`, accesibles solo al rol investigador, para
  vigilarse desde el primer registro de la próxima ola (entregable de Fase 4).
- **Alarma:** una consulta única de tablero (`v_qtl_dashboard`) que devuelva una fila
  por QTL con `valor`, `umbral`, `en_alarma boolean` para revisión diaria.
- **Registro de acción:** cuando un QTL entre en alarma, documentar en el changelog de
  la ola la causa y la acción (re-entrenamiento, back-check, revisión de catálogo).

---

## PUNTO DE CONTROL — requiere tu visto bueno antes de implementar

Este es el **único punto de aprobación obligatorio** del prompt. Detengo aquí la
implementación. Las decisiones abiertas (varias disparan reglas de parada) están en la
respuesta del chat y resumidas aquí:

1. **Alcance:** ¿confirmas limitar la implementación a los huecos reales (R2 por bloque,
   R3 enums, R8, R7 al esquema, y evaluar R5/R4 a DB), sin rehacer lo ya en producción?
2. **R2 — umbral de tiempo mínimo por sección** (y «% de la mediana» para el flag de
   encuestador): **regla de parada**, requiere tu criterio.
3. **R5 — tabla hija `medicamento_item`:** es un **cambio de modelo de datos** (hoy es
   `jsonb` embebido, ya funcional). ¿Migramos a tabla hija (mejor integridad, peso por
   ítem) o mantenemos `jsonb` y solo añadimos `estado_vencimiento`/peso por ítem dentro?
4. **R4 — `municipio_dane` + FK en DB:** ¿bajamos el catálogo DANE al esquema (integridad
   referencial) o basta la canonicalización en cliente ya existente?
5. **PII/RLS:** ¿añadimos RLS por columna + vista analítica SQL desidentificada, o basta
   la desidentificación en la capa de export ya existente?
6. **Respaldo Free tier:** ¿autorizas una GitHub Action de respaldo periódico a Supabase
   Storage/externo? ¿Y evalúo pasar a Pro (backups diarios) como decisión tuya?
7. **CSV histórico real** (`MEDD_2026-07-21.csv`, con PII) para el test de regresión:
   ¿lo aportas anonimizado o mantenemos el fixture sintético actual?
