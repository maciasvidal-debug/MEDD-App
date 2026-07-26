import { supabase } from './supabase'
import { getAllSurveys, saveManySurveys, getDeletionIds, removeDeletions } from './db'
import { toRow, fromRow } from './sync-mapping'
import type { Survey, UserRole, Settings } from '../types'

// ─── Surveyor profile (account-synced) ───────────────────────────────────────
// The profile lives in public.user_profiles (RLS: each user owns its row) so it
// follows the account across devices instead of being trapped in this device's
// IndexedDB. Returns the profile slice of Settings, or null if none exists yet.

export async function fetchProfile(): Promise<Partial<Settings> | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('nui_encuestador, etr_programa, etr_tipo_inst, etr_semestre, etr_institucion')
      .maybeSingle()
    if (error || !data) return null
    return {
    nuiEncuestador: data.nui_encuestador ?? '',
    etrPrograma:    (data.etr_programa as Settings['etrPrograma']) ?? '',
    etrTipoInst:    (data.etr_tipo_inst as Settings['etrTipoInst']) ?? '',
      etrSemestre:    data.etr_semestre != null ? String(data.etr_semestre) : '',
      etrInstitucion: data.etr_institucion ?? '',
    }
  } catch {
    return null
  }
}

export async function upsertProfile(userId: string, settings: Settings): Promise<boolean> {
  const semestre = settings.etrSemestre ? parseInt(settings.etrSemestre, 10) : null
  try {
    const { error } = await supabase.from('user_profiles').upsert({
      user_id:         userId,
      nui_encuestador: settings.nuiEncuestador || null,
      etr_programa:    settings.etrPrograma    || null,
      etr_tipo_inst:   settings.etrTipoInst    || null,
      etr_semestre:    Number.isFinite(semestre) ? semestre : null,
      etr_institucion: settings.etrInstitucion || null,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id' })
    return !error
  } catch {
    return false
  }
}

// ─── Remote operations ───────────────────────────────────────────────────────

// All remote helpers below are deliberately non-throwing: a hard network failure
// (offline, DNS, CORS, abort) can reject the underlying fetch rather than return
// an { error } object. Returning a safe sentinel keeps offline behaviour
// deterministic and avoids unhandled rejections in fire-and-forget callers; the
// next sync simply retries.
export async function pushSurvey(survey: Survey, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('surveys')
      .upsert(toRow(survey, userId), { onConflict: 'id' })
    return !error
  } catch {
    return false
  }
}

export async function pushSurveys(surveys: Survey[], userId: string): Promise<boolean> {
  if (!surveys.length) return true
  try {
    const { error } = await supabase
      .from('surveys')
      .upsert(surveys.map(survey => toRow(survey, userId)), { onConflict: 'id' })
    return !error
  } catch {
    return false
  }
}

// Cambio 2a: sincroniza las COORDENADAS a la tabla aislada `survey_geo`
// (RLS de dueño). WRITE-ONLY por diseño: el cliente sube su geo pero NUNCA la
// vuelve a bajar (la coordenada cruda no debe circular; el análisis de puntos lo
// hace un rol privilegiado fuera de la app). Solo sube filas con consentimiento y
// coordenada válida. Best-effort no-throwing como el resto del sync.
export async function pushSurveyGeo(surveys: Survey[], userId: string): Promise<boolean> {
  const rows = surveys
    .filter(s => s.geoConsent && s.geoLat != null && s.geoLng != null)
    .map(s => ({
      survey_id:       s.id,
      geo_lat:         s.geoLat,
      geo_lng:         s.geoLng,
      geo_accuracy_m:  s.geoAccuracyM ?? null,
      geo_captured_at: s.geoCapturedAt || null,
    }))
  if (!rows.length) return true
  try {
    // Nota: no dependemos de userId aquí — la RLS de `survey_geo` valida la
    // propiedad contra surveys.user_id = auth.uid() en el servidor.
    void userId
    const { error } = await supabase.from('survey_geo').upsert(rows, { onConflict: 'survey_id' })
    return !error
  } catch {
    return false
  }
}

export async function deleteSurveyRemote(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('surveys').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}

export async function deleteSurveysRemote(ids: string[]): Promise<boolean> {
  if (!ids.length) return true
  try {
    const { error } = await supabase.from('surveys').delete().in('id', ids)
    return !error
  } catch {
    return false
  }
}

export async function pullSurveys(): Promise<Survey[]> {
  try {
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map(fromRow)
  } catch {
    return []
  }
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

  // 0. Flush deletion tombstones first. Retry the remote delete for each; only
  //    drop the tombstone when the server confirms, so an offline/failed delete
  //    is never lost. Any still-pending id is kept in `tombstoned` to guard the
  //    pull below from resurrecting a row the user already deleted locally.
  const tombstoned = new Set<string>()
  const deletionIds = await getDeletionIds()
  if (deletionIds.length) {
    // Single bulk delete instead of one request per id. The server applies it
    // atomically, so either every tombstone is confirmed (drop them all) or the
    // call failed (keep them all pending to retry and guard the pull below).
    const ok = await deleteSurveysRemote(deletionIds)
    if (ok) {
      await removeDeletions(deletionIds)
    } else {
      for (const id of deletionIds) tombstoned.add(id)
    }
  }

  // 1. Push (encuestadores only) — all requests in parallel, then batch-save synced ones
  let pushed = 0
  if (role === 'encuestador') {
    const ok = await pushSurveys(local, userId)
    const synced = ok ? local.map(survey => ({ ...survey, syncStatus: 'synced' as const })) : []
    await saveManySurveys(synced)
    pushed = synced.length
    // Cambio 2a: sube las coordenadas a la tabla aislada (best-effort, write-only).
    // No bloquea el sync ni cambia `pushed` (métrica de encuestas). Reintenta la
    // próxima vez si falla.
    await pushSurveyGeo(local, userId)
  }

  // 2. Pull remote surveys and merge into local IDB — single bulk write
  const remote = await pullSurveys()
  const toSave: Survey[] = []
  for (const remoteSurvey of remote) {
    // Don't resurrect a locally-deleted survey whose remote delete is still
    // pending (server hasn't confirmed the tombstone yet).
    if (tombstoned.has(remoteSurvey.id)) continue
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
