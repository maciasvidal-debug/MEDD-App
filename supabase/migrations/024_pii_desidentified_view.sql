-- =====================================================================
-- MEDD-App — 024 Vista analítica desidentificada (RBQM · PII, Ley 1581)
--
-- Contexto: el instrumento captura PII directa (dir = dirección, nui_etr,
-- etr_institucion) y datos sensibles de salud. El export analítico del cliente ya
-- desidentifica (toAnalyticalCSV: omite dir, seudonimiza nui_etr, depura texto),
-- pero el anexo pide que el ESQUEMA ofrezca una VISTA analítica desidentificada
-- SEPARADA de la operativa, como última línea de defensa para el acceso del
-- investigador y para compartir sin exponer identificadores directos.
--
-- Qué añade (ADITIVO, sin tocar la RLS existente):
--   * v_analitico_desidentificado (security_invoker): espeja la política del
--     export — OMITE dir; SEUDONIMIZA nui_etr → encuestador_cluster y hogar_id →
--     hogar_seudo (hash estable md5, preserva el clúster para modelar el efecto
--     encuestador/hogar sin exponer el id crudo); OMITE etr_institucion
--     (potencialmente identificante); conserva las variables analíticas, incluido
--     el texto clínico (prb_salud) por su valor cualitativo.
--
-- REGLA DE PARADA respetada: NO se modifica ninguna política RLS ni se revoca
-- acceso a columnas de `surveys`. Cambiar la RLS podría dejar sin acceso a la app
-- de captura en producción antes de validar las políticas. La separación estricta
-- de roles (apuntar al rol investigador SOLO a esta vista, revocando su lectura de
-- surveys) queda propuesta como cutover posterior, a validar en un entorno seguro
-- (no se hace aquí). security_invoker = la RLS de surveys sigue aplicando a la vista.
--
-- Idempotente: create or replace view. Rollback: drop view if exists
-- public.v_analitico_desidentificado;
-- =====================================================================

create or replace view public.v_analitico_desidentificado
  with (security_invoker = true) as
select
  s.id,
  s.f_eta,
  s.nui,
  -- Seudónimos estables (preservan el clúster, ocultan el id crudo).
  'E-' || upper(substr(md5(coalesce(s.nui_etr::text, '')), 1, 7)) as encuestador_cluster,
  case when s.hogar_id is null or s.hogar_id = '' then null
       else 'H-' || upper(substr(md5(s.hogar_id), 1, 7)) end       as hogar_seudo,
  s.metodo_seleccion,
  s.instrument_version,
  -- Perfil del encuestador SIN institución (identificante) ni id crudo.
  s.etr_programa,
  s.etr_tipo_inst,
  s.etr_semestre,
  -- Geografía (no PII directa) + código DANE.
  s.f_nac,
  s.ciudad,
  s.departamento,
  s.municipio_codigo,
  s.estrato,
  s.etnia,
  s.as_salud,
  s.est_lab,
  s.ingreso,
  s.nv_estu,
  s.nv_posg,
  -- Salud (valor cualitativo; texto libre conservado por su valor analítico).
  s.per_salud,
  s.est_salud,
  s.prb_salud,
  s.con_med,
  s.med_prc,
  s.f_prc,
  s.f_disp,
  s.ind_med,
  s.med_sob,
  s.disp_med_vc,
  s.cto_disp_vc,
  s.vto_med_nc,
  s.cant_med,
  s.cant_med_vto,
  s.peso_med_nc,
  s.mot_no_consumo,
  s.mot_no_consumo_otro,
  s.mot_vencimiento,
  s.mot_vencimiento_otro,
  s.disp_final,
  s.disp_final_otro,
  s.conoce_puntos,
  s.cual_punto,
  s.data_env,
  s.started_at,
  s.created_at
  -- OMITIDO deliberadamente: dir (localizador directo), nui_etr crudo,
  -- etr_institucion, hogar_id crudo, obs (texto libre de alto riesgo residual).
from public.surveys s;

comment on view public.v_analitico_desidentificado is
  'Vista analítica DESIDENTIFICADA (Ley 1581): omite dir/nui_etr crudo/etr_institucion/hogar_id crudo; seudonimiza clúster de encuestador y hogar. security_invoker: hereda la RLS de surveys. Para compartir/analizar sin exponer identificadores directos.';
