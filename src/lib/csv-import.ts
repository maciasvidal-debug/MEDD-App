// =====================================================================
// Lector del CSV de export histórico → Survey[]. Espejo inverso de toCSV.
//
// Propósito: garantizar la NO-REGRESIÓN de lectura del dato del piloto. El
// export histórico (MEDD_2026-07-21.csv) mezcla instrumento v1 y v2, tiene
// `instrumentVersion` nulo en la mayoría de filas, `ciudad` en texto libre y la
// celda `medications` con solo 5 subcampos (sin estadoVencimiento). Este parser
// se mapea por NOMBRE de columna (no por posición), de modo que columnas
// añadidas/quitadas entre versiones del export no lo rompen.
//
// Es tolerante por diseño: NO aplica las validaciones de captura (un F_ETA de
// 2012 histórico se lee tal cual), solo estructura el dato. La normalización de
// invariantes (instrumentVersion no nulo) se aplica igual que en la frontera de
// lectura de la app, para que el histórico entre coherente.
// =====================================================================
import type { Survey, Medication, UnidadConc, MetodoSeleccion } from '../types'

// ─── Tokenizador CSV (comillas, comas embebidas, CRLF, comillas escapadas) ──
export function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  // Descarta el BOM inicial si está presente.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } // comilla escapada ""
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
    } else if (ch === '\r') {
      // fin de línea CRLF: se maneja en el '\n'; ignora el '\r' suelto.
    } else {
      field += ch
    }
  }
  // Última fila si el archivo no termina en salto de línea.
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

const toNumOrNull = (v: string | undefined): number | null => {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Un producto histórico trae 5 subcampos (nmMed;dci;concMed;undConc;fVto); el
// export v2 añadió un 6º (estadoVencimiento, derivado, aquí ignorado) y el v3 un
// 7º (fuenteObtencion, RBQM R8). El mapeo por posición tolera celdas más cortas:
// los campos ausentes quedan '' (histórico ⇒ fuenteObtencion vacía = no preguntado).
function parseMedications(cell: string | undefined): Medication[] {
  if (!cell || cell.trim() === '') return []
  return cell.split('|').map(part => {
    const [nmMed = '', dci = '', concMed = '', undConc = '', fVto = '', , fuenteObtencion = ''] = part.split(';')
    return {
      nmMed,
      dci,
      concMed: toNumOrNull(concMed),
      undConc: (undConc as UnidadConc) ?? '',
      fVto,
      fuenteObtencion: fuenteObtencion as Medication['fuenteObtencion'],
    }
  })
}

/**
 * Parsea un CSV de export MEDD a Survey[]. Mapea por nombre de columna, tolera
 * columnas ausentes y normaliza la invariante de versión (nulo → 1 = v1).
 */
export function parseSurveysCSV(text: string): Survey[] {
  const rows = parseCSVRows(text).filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''))
  if (rows.length === 0) return []
  const header = rows[0]
  const idx = new Map(header.map((h, i) => [h.trim(), i]))
  const col = (r: string[], name: string): string => {
    const i = idx.get(name)
    return i == null ? '' : (r[i] ?? '')
  }

  return rows.slice(1).map(r => {
    const rawVersion = col(r, 'instrumentVersion')
    // Invariante Rec. 1: un histórico sin versión es v1 (no nulo).
    const instrumentVersion = rawVersion.trim() === '' ? 1 : (toNumOrNull(rawVersion) ?? 1)
    const splitMulti = (name: string): string[] => {
      const v = col(r, name)
      return v.trim() === '' ? [] : v.split(';').map(x => x.trim()).filter(Boolean)
    }

    const survey: Survey = {
      id:        col(r, 'id'),
      createdAt: col(r, 'createdAt'),
      updatedAt: col(r, 'updatedAt'),
      startedAt: col(r, 'startedAt') || undefined,
      instrumentVersion,
      fEta:   col(r, 'fEta'),
      nuiEtr: toNumOrNull(col(r, 'nuiEtr')),
      nui:    toNumOrNull(col(r, 'nui')) ?? 0,
      hogarId:         col(r, 'hogarId'),
      metodoSeleccion: (col(r, 'metodoSeleccion') as MetodoSeleccion) ?? '',
      etrPrograma:    col(r, 'etrPrograma') as Survey['etrPrograma'],
      etrTipoInst:    col(r, 'etrTipoInst') as Survey['etrTipoInst'],
      etrSemestre:    toNumOrNull(col(r, 'etrSemestre')),
      etrInstitucion: col(r, 'etrInstitucion'),
      fNac:   col(r, 'fNac'),
      ciudad: col(r, 'ciudad'),
      departamento: col(r, 'departamento') || undefined,
      dir:     col(r, 'dir'),
      estrato: toNumOrNull(col(r, 'estrato')),
      etnia:   col(r, 'etnia') as Survey['etnia'],
      asSalud: col(r, 'asSalud') as Survey['asSalud'],
      estLab:  col(r, 'estLab') as Survey['estLab'],
      ingreso: col(r, 'ingreso') as Survey['ingreso'],
      nvEstu:  col(r, 'nvEstu') as Survey['nvEstu'],
      nvPosg:  col(r, 'nvPosg') as Survey['nvPosg'],
      perSalud: col(r, 'perSalud') as Survey['perSalud'],
      estSalud: col(r, 'estSalud') as Survey['estSalud'],
      prbSalud: col(r, 'prbSalud'),
      conMed:   col(r, 'conMed') as Survey['conMed'],
      medPrc:   col(r, 'medPrc') as Survey['medPrc'],
      fPrc:     col(r, 'fPrc'),
      fDisp:    col(r, 'fDisp'),
      indMed:   col(r, 'indMed') as Survey['indMed'],
      medSob:    col(r, 'medSob') as Survey['medSob'],
      dispMedVc: col(r, 'dispMedVc') as Survey['dispMedVc'],
      ctoDispVc: col(r, 'ctoDispVc'),
      vtoMedNc:  col(r, 'vtoMedNc') as Survey['vtoMedNc'],
      cantMed:    toNumOrNull(col(r, 'cantMed')),
      cantMedVto: toNumOrNull(col(r, 'cantMedVto')),
      pesoMedNc:  toNumOrNull(col(r, 'pesoMedNc')),
      medications: parseMedications(col(r, 'medications')),
      motNoConsumo:       splitMulti('motNoConsumo'),
      motNoConsumoOtro:   col(r, 'motNoConsumoOtro'),
      motVencimiento:     splitMulti('motVencimiento'),
      motVencimientoOtro: col(r, 'motVencimientoOtro'),
      dispFinal:          splitMulti('dispFinal'),
      dispFinalOtro:      col(r, 'dispFinalOtro'),
      conocePuntos:       col(r, 'conocePuntos') as Survey['conocePuntos'],
      cualPunto:          col(r, 'cualPunto'),
      obs: col(r, 'obs'),
    }
    return survey
  })
}
