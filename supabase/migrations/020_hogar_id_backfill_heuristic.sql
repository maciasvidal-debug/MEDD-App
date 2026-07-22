-- =====================================================================
-- MEDD-App — 020 Back-fill HEURÍSTICO de hogar_id en históricos (Sec. 7 Rec. 5)
--
-- Contexto:
--   Los registros del piloto no traen hogar_id (se capturó desde 018 en
--   adelante). Para hacer PARCIALMENTE modelable el agrupamiento por hogar en el
--   dato histórico, se infieren hogares de la evidencia disponible: filas que
--   comparten la MISMA dirección normalizada (`dir`) dentro del mismo municipio
--   (`ciudad`) se tratan como el mismo hogar.
--
-- ⚠️ ES UNA INFERENCIA, NO UN DATO CAPTURADO. Por eso:
--   * Solo agrupa cuando hay EVIDENCIA de co-residencia: grupos de ≥2 filas con
--     la misma (dir, ciudad) normalizada. Los singletons quedan NULL (un hogar
--     de 1 no aporta información de agrupamiento y no debe inventarse un id).
--   * El id inferido lleva prefijo **HH-** (distinto del **H-** que autogenera
--     la app en captura), para que el análisis pueda distinguir y, si lo desea,
--     EXCLUIR los hogares inferidos (`hogar_id like 'HH-%'`).
--   * Riesgo conocido: dos hogares reales distintos con una dirección idéntica e
--     incompleta se fusionarían. La longitud media de `dir` (~17,5) sugiere
--     direcciones razonablemente específicas, pero la inferencia es aproximada;
--     trátese como tal en el análisis (sensibilidad con y sin HH-).
--
-- Normalización de la clave: minúsculas, espacios colapsados, recorte. (No se
-- pliegan tildes para no depender de la extensión `unaccent`.)
--
-- Idempotente: solo actualiza filas con hogar_id NULL; re-ejecutar no cambia nada
-- (ya no quedan NULL en esos grupos). El id es un hash determinista de la clave,
-- así que produce el mismo valor en cada corrida.
--
-- Rollback: update public.surveys set hogar_id = null where hogar_id like 'HH-%';
-- =====================================================================

with keyed as (
  select
    id, hogar_id,
    nullif(btrim(regexp_replace(lower(coalesce(dir, '')),    '\s+', ' ', 'g')), '') as ndir,
    nullif(btrim(regexp_replace(lower(coalesce(ciudad, '')), '\s+', ' ', 'g')), '') as nciudad
  from public.surveys
),
grouped as (
  select
    id,
    ndir || '|' || coalesce(nciudad, '')                       as key,
    count(*) over (partition by ndir, nciudad)                 as grp_size
  from keyed
  where hogar_id is null           -- solo históricos sin id (no toca capturas nuevas)
    and ndir is not null           -- sin dirección no hay evidencia
)
update public.surveys s
set hogar_id   = 'HH-' || upper(substr(md5(g.key), 1, 6)),
    updated_at = now()
from grouped g
where s.id = g.id
  and g.grp_size >= 2;             -- solo grupos con ≥2 co-residentes

comment on column public.surveys.hogar_id is
  'Identificador de hogar (clúster). Co-residentes comparten código. Prefijo H- = capturado en la app; HH- = INFERIDO retrospectivamente (020) por dirección+municipio compartidos (heurístico, excluible con hogar_id like ''HH-%''). NULL = sin hogar identificable.';
