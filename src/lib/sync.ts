import { supabase } from './supabase'
import { getAllSurveys, saveSurvey, saveManySurveys } from './db'
import type { Survey, Medication, UserRole } from '../types'

// ─── Mapping helpers ─────────────────────────────────────────────────────────

type SupabaseRow = Record<string, unknown>

function toRow(survey: Survey, userId: string): SupabaseRow {
  return {
    id:           survey.id,
    user_id:      userId,
    created_at:   survey.createdAt,
    updated_at:   survey.updatedAt,
    f_eta:        survey.fEta   || null,
    nui_etr:      survey.nuiEtr,
    nui:          survey.nui,
    f_nac:        survey.fNac   || null,
    ciudad:       survey.ciudad || null,
    dir:          survey.dir    || null,
    estrato:      survey.estrato,
    etnia:        survey.etnia  || null,
    as_salud:     survey.asSalud  || null,
    est_lab:      survey.estLab   || null,
    ingreso:      survey.ingreso  || null,
    nv_estu:      survey.nvEstu   || null,
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
    medications:  survey.medications,
    obs:          survey.obs || null,
  }
}

function fromRow(row: SupabaseRow): Survey {
  return {
    id:          row.id as string,
    createdAt:   row.created_at as string,
    updatedAt:   row.updated_at as string,
    fEta:        (row.f_eta as string)  ?? '',
    nuiEtr:      row.nui_etr as number | null,
    nui:         row.nui as number,
    fNac:        (row.f_nac as string)  ?? '',
    ciudad:      (row.ciudad as string) ?? '',
    dir:         (row.dir as string)    ?? '',
    estrato:     row.estrato as number | null,
    etnia:       ((row.etnia as string)    ?? '') as Survey['etnia'],
    asSalud:     ((row.as_salud as string) ?? '') as Survey['asSalud'],
    estLab:      ((row.est_lab as string)  ?? '') as Survey['estLab'],
    ingreso:     ((row.ingreso as string)  ?? '') as Survey['ingreso'],
    nvEstu:      ((row.nv_estu as string)  ?? '') as Survey['nvEstu'],
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
    medications: (row.medications as Medication[]) ?? [],
    obs:         (row.obs as string) ?? '',
    syncStatus:  'synced',
  }
}

// ─── Remote operations ───────────────────────────────────────────────────────

export async function pushSurvey(survey: Survey, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('surveys')
    .upsert(toRow(survey, userId), { onConflict: 'id' })
  return !error
}

export async function deleteSurveyRemote(id: string): Promise<boolean> {
  const { error } = await supabase.from('surveys').delete().eq('id', id)
  return !error
}

export async function pullSurveys(): Promise<Survey[]> {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(fromRow)
}

// ─── Full sync on login ──────────────────────────────────────────────────────
// Encuestador : push local surveys → pull remote-only → merge to IDB.
// Investigador: pull-only (read-only analyst — never pushes others' surveys).
// Last-write-wins on updatedAt. Each encuestador works solo, conflicts are rare.

export async function fullSync(
  userId: string,
  role: UserRole,
): Promise<{ pushed: number; pulled: number }> {
  const local    = await getAllSurveys()
  const localMap = new Map(local.map(s => [s.id, s]))

  // 1. Push (encuestadores only) — all requests in parallel, then batch-save synced ones
  let pushed = 0
  if (role === 'encuestador') {
    const results = await Promise.all(
      local.map(survey => pushSurvey(survey, userId).then(ok => ({ survey, ok })))
    )
    const synced = results.filter(r => r.ok).map(r => ({ ...r.survey, syncStatus: 'synced' as const }))
    await saveManySurveys(synced)
    pushed = synced.length
  }

  // 2. Pull remote surveys and merge into local IDB — single bulk write
  const remote = await pullSurveys()
  const toSave: Survey[] = []
  for (const remoteSurvey of remote) {
    const existing = localMap.get(remoteSurvey.id)
    if (!existing) {
      toSave.push(remoteSurvey)
    } else if (remoteSurvey.updatedAt > existing.updatedAt) {
      toSave.push({ ...remoteSurvey, syncStatus: 'synced' })
    }
  }
  await saveManySurveys(toSave)
  const pulled = toSave.length

  return { pushed, pulled }
}
