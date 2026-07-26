#!/usr/bin/env python3
# ==========================================================================
# Genera la tabla de referencia CIE-10 a partir de la Tabla CIE-10 oficial de
# MinSalud (instrumento RIPS). Dos niveles de granularidad:
#   --level 3  → rúbricas de 3 caracteres (2.053)  [tabla aplicada a prod]
#   --level 4  → subcategorías de 4 caracteres (12.568)  [artefacto completo]
#
# Fuente (OFICIAL, verbatim, NO inventada):
#   Ministerio de Salud y Protección Social (Colombia) — Dirección de
#   Epidemiología y Demografía. «Catálogo de patologías – Tabla CIE-10.
#   Instrumentos RIPS». Edición 2018 (traducción CEMECE/WHOFIC), actualización
#   2021-02-08. Archivo tabla-cie-10.zip → «Tabla-CIE-10-2018_08022021 sin
#   restricciones.xlsx», hoja «Final».
#
# Uso:
#   pip install openpyxl
#   python3 scripts/gen_cie10_lookup.py <xlsx> <out.sql> [--level 3|4]
#
# La hoja «Final» trae un preámbulo y el header en la fila 9 (1-based). Columnas:
#   capítulo(1-22) | nombre capítulo | código 3-car | desc 3-car | código 4-car
#   | desc 4-car. La fila es la SUBCATEGORÍA de 4 caracteres.
#
# Determinista: misma entrada → mismo archivo. No asigna códigos «de memoria».
# En --level 3 se deduplica por rúbrica tomando la PRIMERA ocurrencia (las ~18
# variaciones de descripción por rúbrica son cosméticas: coma/espaciado).
# ==========================================================================
import sys

HEADER_MARKER = 'Capitulo'
BATCH = 1000


def sql_str(v):
    if v is None:
        return 'null'
    s = str(v).strip()
    return 'null' if s == '' else "'" + s.replace("'", "''") + "'"


def sql_int(v):
    return 'null' if v is None else str(int(v))


def read_final(xlsx_path):
    import openpyxl
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb['Final']
    rows = list(ws.iter_rows(values_only=True))
    start = None
    for i, r in enumerate(rows):
        if r and r[0] is not None and str(r[0]).strip() == HEADER_MARKER:
            start = i + 1
            break
    if start is None:
        sys.exit('No se encontró el header (celda A == %r)' % HEADER_MARKER)
    out = []
    for r in rows[start:]:
        cap, capnom, c3, d3, c4, d4 = r[0], r[1], r[2], r[3], r[4], r[5]
        if c4 is None or str(c4).strip() == '':
            continue
        out.append((cap, capnom, str(c3).strip() if c3 else None, d3, str(c4).strip(), d4))
    return out


VERSION_NOTE = 'CIE-10 2018 (MinSalud/RIPS, act. 2021-02-08)'


def build_level3(data):
    seen = {}
    for cap, capnom, c3, d3, c4, d4 in data:
        if c3 not in seen:
            seen[c3] = (d3, cap, capnom)          # primera ocurrencia (determinista)
    rows = [(c3, v[0], v[1], v[2]) for c3, v in seen.items()]
    header = """-- =====================================================================
-- MEDD-App — 032 Catálogo CIE-10 (SISPRO/RIPS) — RÚBRICAS de 3 caracteres
--
-- Fuente OFICIAL (verbatim, NO generada de memoria): MinSalud (Colombia),
-- Dir. de Epidemiología y Demografía — «Catálogo de patologías – Tabla CIE-10.
-- Instrumentos RIPS», ed. 2018 (traducción CEMECE/WHOFIC), act. 2021-02-08.
-- Archivo tabla-cie-10.zip → hoja «Final». Generado por scripts/gen_cie10_
-- lookup.py --level 3 (NO editar a mano).
--
-- Granularidad: RÚBRICA de 3 caracteres (p. ej. 'I10' = Hipertensión esencial).
-- Nivel adecuado para codificar el problema de salud AUTORREPORTADO (`prbSalud`)
-- sin falsa precisión. El catálogo completo de 4 caracteres (subcategorías) vive
-- versionado en scripts/data/cie10_4char_full.sql para un eventual uso RIPS. %d rúbricas.
--
-- Uso previsto: codificación ASISTIDA (humano en el bucle) del texto libre; y
-- validación de que un código asignado exista. NO se auto-codifica (no es
-- determinista) — decisión anti-error (κ, comentario C del bioestadístico).
--
-- Idempotente: create table if not exists + on conflict do nothing. RLS de solo
-- lectura para autenticados. Rollback: drop table public.cie10_sispro.
-- =====================================================================

create table if not exists public.cie10_sispro (
  codigo          text primary key,   -- CIE-10 rúbrica de 3 caracteres (p. ej. 'I10')
  descripcion     text not null,      -- título de la rúbrica
  capitulo        int,                -- capítulo CIE-10 (1-22)
  capitulo_nombre text,
  version         text not null default '%s — rúbricas 3 car'
);
create index if not exists idx_cie10_capitulo on public.cie10_sispro(capitulo);

alter table public.cie10_sispro enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='cie10_sispro' and policyname='cie10_sispro_read') then
    create policy cie10_sispro_read on public.cie10_sispro for select to authenticated using (true);
  end if;
end $$;

comment on table public.cie10_sispro is
  'Catálogo CIE-10 oficial (MinSalud/RIPS 2018, act. 2021-02-08) a nivel de RÚBRICA (3 car). Referencia de solo lectura para codificación asistida y validación. Fuente: tabla-cie-10.zip (RID MinSalud).';
""" % (len(rows), VERSION_NOTE)
    cols = '(codigo,descripcion,capitulo,capitulo_nombre)'
    def render(t):
        c3, d3, cap, capnom = t
        return '(%s,%s,%s,%s)' % (sql_str(c3), sql_str(d3), sql_int(cap), sql_str(capnom))
    return header, cols, rows, render


def build_level4(data):
    rows = [(c4, d4, c3, d3, cap, capnom) for cap, capnom, c3, d3, c4, d4 in data]
    header = """-- =====================================================================
-- CIE-10 (SISPRO/RIPS) — catálogo COMPLETO de 4 caracteres (subcategorías)
--
-- Artefacto de referencia versionado (NO es una migración aplicada). Fuente
-- OFICIAL verbatim: MinSalud, «Tabla CIE-10 Instrumentos RIPS» ed. 2018, act.
-- 2021-02-08 (tabla-cie-10.zip → hoja «Final»). Generado por
-- scripts/gen_cie10_lookup.py --level 4 (NO editar a mano). %d subcategorías.
--
-- Para llevar prod a 4 caracteres: aplicar este SQL por el canal de migraciones
-- (supabase db push / psql con SUPABASE_DB_URL) — no por MCP (2 MB). Sustituye o
-- complementa la tabla de rúbricas de la migración 032 según la decisión de
-- granularidad que se tome entonces.
--
-- Idempotente: create table if not exists + on conflict do nothing.
-- =====================================================================

create table if not exists public.cie10_sispro_4car (
  codigo          text primary key,   -- CIE-10 4 caracteres (subcategoría), p. ej. 'I10X'
  descripcion     text not null,
  categoria       text,               -- rúbrica de 3 caracteres
  categoria_desc  text,
  capitulo        int,
  capitulo_nombre text,
  version         text not null default '%s — 4 car'
);
create index if not exists idx_cie10_4car_categoria on public.cie10_sispro_4car(categoria);

alter table public.cie10_sispro_4car enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='cie10_sispro_4car' and policyname='cie10_sispro_4car_read') then
    create policy cie10_sispro_4car_read on public.cie10_sispro_4car for select to authenticated using (true);
  end if;
end $$;
""" % (len(rows), VERSION_NOTE)
    cols = '(codigo,descripcion,categoria,categoria_desc,capitulo,capitulo_nombre)'
    def render(t):
        c4, d4, c3, d3, cap, capnom = t
        return '(%s,%s,%s,%s,%s,%s)' % (
            sql_str(c4), sql_str(d4), sql_str(c3), sql_str(d3), sql_int(cap), sql_str(capnom))
    return header, cols, rows, render


def main():
    argv = sys.argv[1:]
    level = '3'
    if '--level' in argv:
        i = argv.index('--level')
        level = argv[i + 1]
        del argv[i:i + 2]
    args = argv
    if len(args) != 2:
        sys.exit('uso: gen_cie10_lookup.py <xlsx> <out.sql> [--level 3|4]')
    data = read_final(args[0])

    build = build_level3 if level == '3' else build_level4
    header, cols, rows, render = build(data)
    tbl = 'public.cie10_sispro' if level == '3' else 'public.cie10_sispro_4car'

    assert len({r[0] for r in rows}) == len(rows), 'PK duplicada'

    parts = [header]
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        vals = ',\n'.join(render(t) for t in chunk)
        parts.append('insert into %s %s values\n%s\non conflict (codigo) do nothing;\n' % (tbl, cols, vals))
    out = '\n'.join(parts)
    with open(args[1], 'w', encoding='utf-8') as f:
        f.write(out)
    print('level %s → filas: %d  archivo: %s  bytes: %d' % (level, len(rows), args[1], len(out.encode('utf-8'))))


if __name__ == '__main__':
    main()
