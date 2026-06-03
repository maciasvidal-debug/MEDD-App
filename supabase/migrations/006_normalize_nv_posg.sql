-- =====================================================================
-- MEDD-App — Migración de limpieza
-- Normaliza NV_POSG tras el rediseño: deja de ser un campo independiente
-- con opción 'Ninguno' y pasa a ser el sub-nivel de la opción 'Posgrado'
-- de NV_ESTU. Cualquier valor heredado que no cumpla la nueva regla
-- (p. ej. 'Ninguno', o un nv_posg con nv_estu distinto de 'Posgrado')
-- se anula. Idempotente: seguro de re-ejecutar.
-- =====================================================================

update public.surveys
set    nv_posg = null
where  nv_posg is not null
  and  (nv_estu is distinct from 'Posgrado'
        or nv_posg not in ('Especialización', 'Maestría', 'Doctorado'));
