-- =====================================================================
-- MEDD-App — 031 Derivación AWaRe (Sección 11, Cambio 1a · R9)
--
-- Cierra la decisión abierta del Cambio 1a: cómo pasar del principio activo
-- CAPTURADO (texto libre en español, ruidoso) a la categoría AWaRe (Access/Watch/
-- Reserve) de la OMS, que está en INN inglés + ATC nivel 5 (tabla `aware_lookup`,
-- migración 029).
--
-- Decisión (mejores prácticas / mínima fricción y error):
--  • SERVER-SIDE, SIN captura nueva: el encuestador sigue digitando el DCI libre;
--    la categoría se DERIVA post-hoc por join. Cero fricción, cero cambio de UI,
--    cero riesgo de regresión en la app. La analítica de la Sección 11 vive fuera
--    de la app y consume estas vistas.
--  • ANTI-ALUCINACIÓN: el puente `aware_bridge` mapea SOLO nombre-español→nombre-
--    inglés (ambos verificables por humano). El ATC5 y la categoría NUNCA se
--    escriben aquí: se leen por join de `aware_lookup` (fuente OMS 2025 verbatim).
--    Un FK duro a `aware_lookup(antibiotic)` impide referenciar un antibiótico
--    inexistente (un typo o un nombre inventado FALLA el insert, no entra silencioso).
--  • REGLA DE PARADA (mapeo fiable): el puente cubre los antibióticos del piloto
--    (verificados contra el dato real: amoxicilina, ampicilina, cefalexina,
--    ciprofloxacina/o, clindamicina, doxiciclina) MÁS antibióticos ambulatorios
--    comunes en Colombia cuyo mapeo es-→en es inequívoco. Todo DCI no cubierto o no
--    antibiótico → categoría NULL (cobertura honesta), nunca una clase arriesgada.
--
-- Limitaciones documentadas:
--  • El emparejamiento usa el PRIMER token alfabético del DCI (los DCI de
--    antibióticos encabezan con el principio activo). Un combo se clasifica por su
--    agente base; p. ej. «amoxicilina + ácido clavulánico» → Amoxicillin: la
--    CATEGORÍA es correcta (amox y amox/clav son ambos Access), aunque el ATC5
--    refleje el agente base. Metronidazol NO está en la lista antibacteriana AWaRe
--    2025 → NULL (correcto).
--  • `medicamento_item.atc_codigo` no está poblado, así que el denominador real de
--    antibióticos (J01) no se determina en esta vista; eso es parte del análisis.
--
-- Idempotente: create table if not exists + on conflict do nothing; create or
-- replace view/function. RLS de solo lectura en el puente (dato de referencia).
-- Rollback: drop view v_qtl_aware, v_medicamento_aware; drop table aware_bridge;
--           drop function medd_dci_token(text).
-- =====================================================================

-- ── Normalizador del token de DCI (puro, determinista) ──────────────────────
-- Primer token alfabético del texto, en minúsculas y sin diacríticos (ascii).
-- IMMUTABLE + search_path fijo (endurecimiento, misma línea que 026).
create or replace function public.medd_dci_token(p text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select translate(
           lower(coalesce((regexp_match(p, '([[:alpha:]]+)'))[1], '')),
           'áéíóúüñ', 'aeiouun')
$$;

comment on function public.medd_dci_token(text) is
  'Token canónico de DCI (primer token alfabético, minúsculas, sin diacríticos) para el join DCI-es→AWaRe. Puro/determinista.';

-- ── Puente DCI-es (token) → antibiótico AWaRe (INN inglés) ───────────────────
create table if not exists public.aware_bridge (
  dci_token  text primary key,                                  -- token canónico (medd_dci_token)
  antibiotic text not null references public.aware_lookup(antibiotic),  -- FK: no permite inventar
  note       text
);

comment on table public.aware_bridge is
  'Puente curado DCI-español (token) → antibiótico AWaRe (INN inglés en aware_lookup). Solo mapea nombre→nombre; el ATC5/categoría se leen por join de aware_lookup (OMS). FK impide referenciar un antibiótico inexistente.';

alter table public.aware_bridge enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='aware_bridge' and policyname='aware_bridge_read') then
    create policy aware_bridge_read on public.aware_bridge for select to authenticated using (true);
  end if;
end $$;

-- Seed curado. Cada `antibiotic` DEBE existir en aware_lookup (verificado; el FK lo
-- garantiza). Categorías correctas por construcción (se leen de la OMS por join).
insert into public.aware_bridge (dci_token, antibiotic, note) values
  ('amoxicilina',     'Amoxicillin',                    'piloto'),
  ('ampicilina',      'Ampicillin',                     'piloto'),
  ('cefalexina',      'Cefalexin',                      'piloto'),
  ('ciprofloxacina',  'Ciprofloxacin',                  'piloto (grafía -a)'),
  ('ciprofloxacino',  'Ciprofloxacin',                  'piloto (grafía -o)'),
  ('clindamicina',    'Clindamycin',                    'piloto'),
  ('doxiciclina',     'Doxycycline',                    'piloto'),
  -- Ambulatorios comunes en Colombia (mapeo es-→en inequívoco; verificados en aware_lookup):
  ('azitromicina',    'Azithromycin',                   'ambulatorio comun'),
  ('cefadroxilo',     'Cefadroxil',                     'ambulatorio comun'),
  ('cefadroxil',      'Cefadroxil',                     'ambulatorio comun (grafia)'),
  ('cefazolina',      'Cefazolin',                      'ambulatorio comun'),
  ('cefixima',        'Cefixime',                       'ambulatorio comun'),
  ('ceftriaxona',     'Ceftriaxone',                    'ambulatorio comun'),
  ('cefuroxima',      'Cefuroxime',                     'ambulatorio comun'),
  ('claritromicina',  'Clarithromycin',                 'ambulatorio comun'),
  ('cloxacilina',     'Cloxacillin',                    'ambulatorio comun'),
  ('dicloxacilina',   'Dicloxacillin',                  'ambulatorio comun'),
  ('eritromicina',    'Erythromycin',                   'ambulatorio comun'),
  ('gentamicina',     'Gentamicin',                     'ambulatorio comun'),
  ('levofloxacina',   'Levofloxacin',                   'ambulatorio comun (grafia -a)'),
  ('levofloxacino',   'Levofloxacin',                   'ambulatorio comun (grafia -o)'),
  ('nitrofurantoina', 'Nitrofurantoin',                 'ambulatorio comun'),
  ('norfloxacina',    'Norfloxacin',                    'ambulatorio comun (grafia -a)'),
  ('norfloxacino',    'Norfloxacin',                    'ambulatorio comun (grafia -o)'),
  ('tetraciclina',    'Tetracycline',                   'ambulatorio comun'),
  -- Cotrimoxazol: en Colombia «trimetoprim» encabeza el combo trimetoprim/sulfa
  -- (la monoterapia con trimetoprim es rara). Los tres tokens → el MISMO combo,
  -- para que un mismo producto no derive dos ATC5 distintos. Access en todo caso.
  ('trimetoprim',     'Sulfamethoxazole/trimethoprim',  'cotrimoxazol (trimetoprim encabeza el combo en CO)'),
  ('sulfametoxazol',  'Sulfamethoxazole/trimethoprim',  'cotrimoxazol (combo)'),
  ('cotrimoxazol',    'Sulfamethoxazole/trimethoprim',  'cotrimoxazol (combo)')
on conflict (dci_token) do nothing;

-- ── Vista de derivación AWaRe por medicamento (best-effort, NULL-safe) ───────
create or replace view public.v_medicamento_aware
  with (security_invoker = true) as
select mi.id,
       mi.survey_id,
       mi.idx,
       mi.principio_activo,
       public.medd_dci_token(mi.principio_activo) as dci_token,
       al.antibiotic as aware_antibiotic,   -- INN OMS (NULL si no mapeado)
       al.atc_code   as aware_atc5,          -- ATC5 OMS (NULL si no mapeado)
       al.category   as aware_categoria      -- Access | Watch | Reserve | NULL
from public.medicamento_item mi
left join public.aware_bridge ab on ab.dci_token = public.medd_dci_token(mi.principio_activo)
left join public.aware_lookup al on al.antibiotic = ab.antibiotic;

comment on view public.v_medicamento_aware is
  'Derivación AWaRe por medicamento: DCI-es (token) → aware_bridge → aware_lookup (OMS 2025). aware_categoria NULL = no antibiótico o DCI no cubierto por el puente (cobertura honesta, nunca clase inventada). Sección 11 (R9).';

-- ── Monitoreo de cobertura y distribución AWaRe (QTL) ────────────────────────
create or replace view public.v_qtl_aware
  with (security_invoker = true) as
select
  count(*) filter (where aware_categoria is not null) as items_aware_clasificados,
  count(*)                                            as items_total,
  count(*) filter (where aware_categoria = 'Access')  as access_n,
  count(*) filter (where aware_categoria = 'Watch')   as watch_n,
  count(*) filter (where aware_categoria = 'Reserve') as reserve_n
from public.v_medicamento_aware;

comment on view public.v_qtl_aware is
  'Cobertura y distribución AWaRe derivada (Access/Watch/Reserve) sobre medicamento_item. items_aware_clasificados/items_total = cobertura del puente; el denominador de antibióticos reales se afina en el análisis.';
