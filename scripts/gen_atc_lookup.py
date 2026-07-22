#!/usr/bin/env python3
# ==========================================================================
# Genera src/lib/atc-cum.data.ts a partir del export CUM de INVIMA.
#
# Fuente (verificable, datos abiertos):
#   INVIMA — Código Único de Medicamentos Vigentes (CUM)
#   https://www.datos.gov.co/  dataset i7cb-raxc
#   Se necesitan las columnas: atc, descripcionatc, principioactivo.
#
# Uso:
#   pip install openpyxl
#   python3 scripts/gen_atc_lookup.py <CUM.xlsx> src/lib/atc-cum.data.ts
#
# Metodología (ver el encabezado del archivo generado):
#   1) Extraer el principio activo canónico del texto ruidoso del CUM.
#   2) Preferir el ATC de producto de UN SOLO principio activo (descartando el
#      del combinado vía la descripción ATC) y tomar su moda por ingrediente.
#   3) Guardar el subgrupo ATC nivel 2 (3 caracteres).
#
# Determinista: misma entrada → mismo archivo. No asigna códigos "de memoria";
# todo proviene del CUM. Las correcciones puntuales viven en atc.ts, anotadas.
# ==========================================================================
import sys, re, json, unicodedata
from collections import defaultdict
import openpyxl

ATC2 = re.compile(r'^[A-Z]\d{2}')  # nivel 2 (3 primeros: letra+2 dígitos); acepta códigos nivel 2–5
SALT = r'\b(clorhidrato|diclorhidrato|hidrocloruro|bromhidrato|bromuro|sulfato|bisulfato|sodico|sodica|sodio|potasico|potasica|potasio|calcico|calcica|magnesico|maleato|mesilato|besilato|fumarato|hemifumarato|tartrato|bitartrato|succinato|fosfato|difosfato|acetato|dipropionato|propionato|valerato|palmitato|estearato|gluconato|lactato|citrato|nitrato|pamoato|embonato|pivalato|furoato|xinafoato|dihidrato|trihidrato|monohidrato|heptahidrato|pentahidrato|hemihidrato|tetrahidratado|anhidro|anhidra|micronizado|micronizada|base|racemico|bp|usp)\b'
UNITS = r'\b(mg|mcg|ug|g|gr|kg|ml|l|ui|iu|u|meq|mmol|mol|dosis|puff|comprimido|tableta|capsula|ampolla|frasco|vial|sobre|parche|inhalacion|via|oral|elemental|origen|porcino)\b'
COMBO = [',', '+', ' e ', ' y ', 'combinacion', 'asociac', 'diureticos', 'otros', ' con ']


def strip_accents(s: str) -> str:
    return unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode()


def canonical(raw: str) -> str:
    """Extrae el principio activo canónico del texto ruidoso del CUM/DCI."""
    s = strip_accents(raw).lower()
    s = re.sub(r'\([^)]*\)', ' ', s)
    if 'equivalente a' in s:
        s = s.split('equivalente a')[-1]
    s = re.sub(r'[0-9]+([.,][0-9]+)?', ' ', s)
    s = re.sub(r'[/%.,;:+()\-]', ' ', s)
    s = re.sub(UNITS, ' ', s)
    for _ in range(3):
        s = re.sub(SALT, ' ', s)
    s = re.sub(r'\b(de|del|la|el|e|y|como|en|forma|equivalente|a|o|cada|mas)\b', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def is_combo(desc: str) -> bool:
    d = strip_accents(str(desc or '')).lower()
    return any(m in d for m in COMBO)


def main(src, out):
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb['Data']
    it = ws.iter_rows(values_only=True)
    next(it)  # header: atc, descripcionatc, principioactivo
    # canon -> atc -> [count, single_ingredient_count]
    agg = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for atc, desc, pa in it:
        a = str(atc or '').strip().upper()
        if not ATC2.match(a):
            continue
        c = canonical(pa)
        if not c or len(c) < 3:
            continue
        rec = agg[c][a]
        rec[0] += 1
        if not is_combo(desc):
            rec[1] += 1
    lut = {}
    for c, cands in agg.items():
        singles = {a: v for a, v in cands.items() if v[1] > 0}
        pool = singles if singles else cands
        best = max(pool.items(), key=lambda kv: kv[1][1] if singles else kv[1][0])
        lut[c] = best[0][:3]  # subgrupo nivel 2

    items = sorted(lut.items())
    hdr = [
        "// ==========================================================================",
        "// Diccionario DCI → subgrupo ATC (nivel 2), DERIVADO DE FUENTE VERIFICABLE.",
        "//",
        "// Fuente: INVIMA — Código Único de Medicamentos Vigentes (CUM), datos abiertos",
        "//   datos.gov.co dataset i7cb-raxc. Export descargado 2026-07-22 (157.789 filas).",
        "// Generado por scripts/gen_atc_lookup.py (reproducible). NO EDITAR A MANO.",
        "//   1. Por fila se extrae el principio activo CANÓNICO del texto ruidoso.",
        "//   2. Por ingrediente se toma el ATC de producto de UN SOLO principio activo",
        "//      (descarta el combinado vía la descripción ATC) y su moda; p. ej.",
        "//      hidroclorotiazida → C03 (su clase), no C09 (combo).",
        "//   3. Se guarda el subgrupo ATC nivel 2 (3 caracteres); nivel 1 = 1ª letra.",
        "//",
        "// Las correcciones por sesgo de combinado / vacíos del CUM viven, anotadas con",
        "// su ATC oficial, en atc.ts.",
        "// ==========================================================================",
        "",
        "export const ATC_LEVEL2_BY_INGREDIENT: Readonly<Record<string, string>> = Object.freeze({",
    ]
    body = ["  '%s': '%s'," % (k.replace('\\', '\\\\').replace("'", "\\'"), v) for k, v in items]
    open(out, 'w').write("\n".join(hdr + body + ["})", ""]))
    print("escrito %s con %d ingredientes" % (out, len(items)))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
