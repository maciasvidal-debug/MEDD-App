// =====================================================================
// Pure mapping between the local Survey shape (camelCase) and the Supabase
// `surveys` row shape (snake_case). Kept dependency-free (no Supabase client)
// so it loads without env vars and can be unit-tested in isolation.
// =====================================================================
import type { Survey, Medication, DataEnv } from '../types'
import { lookupCodigo } from './divipola'

export type SupabaseRow = Record<string, unknown>

// Treat '' (and null/undefined) as SQL NULL. Mirrors the NULLIF(<text>, '')
// applied inside v_product_metrics (migration 004): an empty string is not NULL
// and would crash the view's ::date / ::numeric casts, so collapse it here too.
const blankToNull = (v: unknown): unknown =>
  v === '' || v === undefined || v === null ? null : v

// Normalize a medication for JSONB storage. The medications array is stored as
// an opaque JSONB blob and read back by the analytics view, which casts
// fVto → date and concMed → numeric. The view already guards every cast with
// NULLIF (migration 004), but normalizing the optional expiry/concentration to
// null *before* they reach the column is belt-and-suspenders: the stored data
// is clean, so even a consumer that reads the JSONB without that guard is safe.
function toMedRow(m: Medication): SupabaseRow {
  return {
    nmMed:   m.nmMed,
    dci:     m.dci,
    // concMed is typed number|null but may arrive as '' from older persisted
    // records, so guard the raw value defensively rather than trusting the type.
    concMed: blankToNull(m.concMed),
    undConc: m.undConc,
    fVto:    blankToNull(m.fVto),
    // RBQM R8: fuente de obtención por medicamento. '' = no preguntado (ítem < v3).
    fuenteObtencion: m.fuenteObtencion ?? '',
  }
}

// Inverse of toMedRow: restore the local Medication invariant (fVto is a string,
// '' when unknown; concMed is number|null) after the write side normalized empty
// optionals to null. Also tolerant of legacy rows that stored '' verbatim.
function fromMedRow(m: Record<string, unknown>): Medication {
  return {
    nmMed:   (m.nmMed as string) ?? '',
    dci:     (m.dci as string) ?? '',
    concMed: m.concMed == null || m.concMed === '' ? null : (m.concMed as number),
    undConc: (m.undConc as Medication['undConc']) ?? '',
    fVto:    m.fVto ? String(m.fVto) : '',
    fuenteObtencion: (m.fuenteObtencion as Medication['fuenteObtencion']) ?? '',
  }
}

export function toRow(survey: Survey, userId: string): SupabaseRow {
  return {
    id:           survey.id,
    user_id:      userId,
    created_at:   survey.createdAt,
    updated_at:   survey.updatedAt,
    started_at:   survey.startedAt || null,
    backcheck_of: survey.backcheckOf || null,
    instrument_version: survey.instrumentVersion ?? null,
    f_eta:        survey.fEta   || null,
    nui_etr:      survey.nuiEtr,
    nui:          survey.nui,
    hogar_id:         survey.hogarId         || null,
    metodo_seleccion: survey.metodoSeleccion || null,
    etr_programa:    survey.etrPrograma    || null,
    etr_tipo_inst:   survey.etrTipoInst    || null,
    etr_semestre:    survey.etrSemestre,
    etr_institucion: survey.etrInstitucion || null,
    f_nac:        survey.fNac   || null,
    ciudad:       survey.ciudad || null,
    departamento: survey.departamento || null,
    // RBQM R4: código DANE derivado del par canónico (ciudad, departamento) para
    // dar integridad referencial a la geografía (FK municipio_dane). '' → NULL.
    municipio_codigo: lookupCodigo(survey.ciudad, survey.departamento) || null,
    dir:          survey.dir    || null,
    // Cambio 2a: solo la BANDERA de consentimiento va a `surveys` (no sensible).
    // Las coordenadas NUNCA viajan aquí — se sincronizan aparte a `survey_geo`
    // (RLS de dueño), para que ni el rol analítico ni el export las vean (R11).
    geo_consent:  survey.geoConsent ?? false,
    estrato:      survey.estrato,
    etnia:        survey.etnia  || null,
    as_salud:     survey.asSalud  || null,
    est_lab:      survey.estLab   || null,
    ingreso:      survey.ingreso  || null,
    nv_estu:      survey.nvEstu   || null,
    nv_posg:      survey.nvPosg   || null,
    per_salud:    survey.perSalud || null,
    est_salud:    survey.estSalud || null,
    prb_salud:    survey.prbSalud || null,
    con_med:      survey.conMed   || null,
    med_prc:      survey.medPrc   || null,
    f_prc:        survey.fPrc     || null,
    f_disp:       survey.fDisp    || null,
    ind_med:      survey.indMed   || null,
    med_sob:      survey.medSob      || null,
    disp_med_vc:  survey.dispMedVc   || null,
    cto_disp_vc:  survey.ctoDispVc   || null,
    vto_med_nc:   survey.vtoMedNc    || null,
    cant_med:     survey.cantMed,
    cant_med_vto: survey.cantMedVto,
    peso_med_nc:  survey.pesoMedNc,
    medications:  (survey.medications ?? []).map(toMedRow),
    mot_no_consumo:       survey.motNoConsumo,
    mot_no_consumo_otro:  survey.motNoConsumoOtro   || null,
    mot_vencimiento:      survey.motVencimiento,
    mot_vencimiento_otro: survey.motVencimientoOtro || null,
    disp_final:           survey.dispFinal,
    disp_final_otro:      survey.dispFinalOtro       || null,
    conoce_puntos:        survey.conocePuntos        || null,
    cual_punto:           survey.cualPunto           || null,
    obs:          survey.obs || null,
  }
}

export function fromRow(row: SupabaseRow): Survey {
  return {
    id:          row.id as string,
    createdAt:   row.created_at as string,
    updatedAt:   row.updated_at as string,
    startedAt:   (row.started_at as string) ?? undefined,
    dataEnv:     (row.data_env as DataEnv) ?? undefined,
    backcheckOf: (row.backcheck_of as string) ?? undefined,
    // Invariante Rec. 1: todo registro lleva versión. Un registro remoto sin
    // versión es, por definición, del instrumento v1 (previo a la batería de
    // motivos) → se normaliza a 1, nunca undefined. Espeja el back-fill 017.
    instrumentVersion: (row.instrument_version as number) ?? 1,
    fEta:        (row.f_eta as string)  ?? '',
    nuiEtr:      row.nui_etr as number | null,
    nui:         row.nui as number,
    hogarId:         (row.hogar_id as string) ?? '',
    metodoSeleccion: ((row.metodo_seleccion as string) ?? '') as Survey['metodoSeleccion'],
    etrPrograma:    ((row.etr_programa as string)  ?? '') as Survey['etrPrograma'],
    etrTipoInst:    ((row.etr_tipo_inst as string) ?? '') as Survey['etrTipoInst'],
    etrSemestre:    row.etr_semestre as number | null,
    etrInstitucion: (row.etr_institucion as string) ?? '',
    fNac:        (row.f_nac as string)  ?? '',
    ciudad:      (row.ciudad as string) ?? '',
    departamento: (row.departamento as string) ?? undefined,
    dir:         (row.dir as string)    ?? '',
    // Solo la bandera vuelve de `surveys`; las coordenadas viven aisladas en
    // `survey_geo` (write-only desde el cliente) y no se re-hidratan aquí.
    geoConsent:  (row.geo_consent as boolean) ?? false,
    estrato:     row.estrato as number | null,
    etnia:       ((row.etnia as string)    ?? '') as Survey['etnia'],
    asSalud:     ((row.as_salud as string) ?? '') as Survey['asSalud'],
    estLab:      ((row.est_lab as string)  ?? '') as Survey['estLab'],
    ingreso:     ((row.ingreso as string)  ?? '') as Survey['ingreso'],
    nvEstu:      ((row.nv_estu as string)  ?? '') as Survey['nvEstu'],
    nvPosg:      ((row.nv_posg as string)  ?? '') as Survey['nvPosg'],
    perSalud:    ((row.per_salud as string) ?? '') as Survey['perSalud'],
    estSalud:    ((row.est_salud as string) ?? '') as Survey['estSalud'],
    prbSalud:    (row.prb_salud as string)  ?? '',
    conMed:      ((row.con_med as string)   ?? '') as Survey['conMed'],
    medPrc:      ((row.med_prc as string)   ?? '') as Survey['medPrc'],
    fPrc:        (row.f_prc as string)  ?? '',
    fDisp:       (row.f_disp as string) ?? '',
    indMed:      ((row.ind_med as string)   ?? '') as Survey['indMed'],
    medSob:      ((row.med_sob as string)     ?? '') as Survey['medSob'],
    dispMedVc:   ((row.disp_med_vc as string) ?? '') as Survey['dispMedVc'],
    ctoDispVc:   (row.cto_disp_vc as string)  ?? '',
    vtoMedNc:    ((row.vto_med_nc as string)  ?? '') as Survey['vtoMedNc'],
    cantMed:     row.cant_med    as number | null,
    cantMedVto:  row.cant_med_vto as number | null,
    pesoMedNc:   row.peso_med_nc  as number | null,
    medications: ((row.medications as Record<string, unknown>[]) ?? []).map(fromMedRow),
    motNoConsumo:       (row.mot_no_consumo as string[]) ?? [],
    motNoConsumoOtro:   (row.mot_no_consumo_otro as string) ?? '',
    motVencimiento:     (row.mot_vencimiento as string[]) ?? [],
    motVencimientoOtro: (row.mot_vencimiento_otro as string) ?? '',
    dispFinal:          (row.disp_final as string[]) ?? [],
    dispFinalOtro:      (row.disp_final_otro as string) ?? '',
    conocePuntos:       ((row.conoce_puntos as string) ?? '') as Survey['conocePuntos'],
    cualPunto:          (row.cual_punto as string) ?? '',
    obs:         (row.obs as string) ?? '',
    syncStatus:  'synced',
  }
}
