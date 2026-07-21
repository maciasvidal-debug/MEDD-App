import { z } from 'zod'
import type { Settings, Survey } from '../types'
import { STUDY_START } from './constants'
import { todayISO } from './date'

// ─── Surveyor profile completeness ──────────────────────────────────────────
// The profile is stamped onto every captured survey, so an incomplete profile
// silently corrupts the surveyor-effect / program-adjusted analyses. All five
// fields are required before an encuestador may capture. Single source of truth
// reused by the onboarding gate, the wizard gate and the settings indicator.
export function isProfileComplete(s: Settings): boolean {
  return Boolean(
    s.nuiEncuestador?.trim() &&
    s.etrPrograma?.trim() &&
    s.etrTipoInst?.trim() &&
    s.etrSemestre?.trim() &&
    s.etrInstitucion?.trim(),
  )
}

// True when a survey is missing any surveyor-profile field — i.e. it was
// captured before the profile was complete and can be backfilled from settings.
export function surveyMissingProfile(s: Survey): boolean {
  return (
    s.nuiEtr == null ||
    !s.etrPrograma ||
    !s.etrTipoInst ||
    s.etrSemestre == null ||
    !s.etrInstitucion
  )
}


const optStr  = z.string()
const siNo    = z.string()
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD inválido').or(z.literal(''))

// F_ETA plausible-range check (Rec. 2): the interview date must fall within the
// study window — no earlier than STUDY_START, no later than today. ISO strings
// compare lexicographically, so a plain string comparison is correct. The empty
// / malformed cases are already handled by the min+regex rules, so this refine
// only judges well-formed dates and passes anything it can't parse (to avoid a
// duplicate/contradictory message).
const fEtaInStudyWindow = (v: string): boolean =>
  !/^\d{4}-\d{2}-\d{2}$/.test(v) || (v >= STUDY_START && v <= todayISO())

// ─── Step 1 — Identificación ──────────────────────────────────────────────
export const step1Schema = z.object({
  fEta:   z.string().min(1, 'La fecha de la entrevista es obligatoria')
           .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD inválido')
           .refine(fEtaInStudyWindow, `La fecha debe estar entre ${STUDY_START} y hoy (no puede ser anterior al estudio ni futura)`),
  nuiEtr: z.number()
            .int('Debe ser un entero')
            .positive('Debe ser un entero positivo'),
  nui:    z.number(),
})

// ─── Step 2 — Demografía ─────────────────────────────────────────────────
// Cross-field rule: NV_POSG (nivel de posgrado) sólo aplica — y es obligatorio —
// cuando NV_ESTU = 'Posgrado'. Mantenemos el objeto base separado del esquema
// refinado para poder reusarlo en `.merge()` (refine devuelve un ZodEffects).
const step2Object = z.object({
  fNac:    z.string().min(1, 'La fecha de nacimiento es obligatoria')
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD inválido'),
  ciudad:  z.string().min(1, 'Seleccione el municipio'),
  departamento: z.string().min(1, 'Seleccione el municipio de la lista para autocompletar el departamento'),
  dir:     optStr,
  estrato: z.number().int().min(1).max(6).nullable().optional(),
  etnia:   z.string().min(1, 'Seleccione una opción'),
  asSalud: z.string().min(1, 'Seleccione el régimen de salud'),
  estLab:  z.string().min(1, 'Seleccione el estado laboral'),
  ingreso: z.string().min(1, 'Seleccione el rango de ingresos'),
  nvEstu:  z.string().min(1, 'Seleccione el nivel de estudios'),
  nvPosg:  optStr,
})

const nvPosgRefine = (data: { nvEstu: string; nvPosg: string }, ctx: z.RefinementCtx) => {
  if (data.nvEstu === 'Posgrado' && !data.nvPosg) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nvPosg'], message: 'Seleccione el nivel de posgrado' })
  }
}

export const step2Schema = step2Object.superRefine(nvPosgRefine)

// ─── Step 3 — Salud ───────────────────────────────────────────────────────
export const step3Schema = z.object({
  perSalud: z.string().min(1, 'Indique la percepción de salud'),
  estSalud: siNo.refine(v => v !== '', 'Responda esta pregunta'),
  prbSalud: optStr,
  conMed:   siNo,
  medPrc:   siNo,
  fPrc:     dateStr,
  fDisp:    dateStr,
  indMed:   siNo,
})

// ─── Step 4 — Almacenamiento & disposición ────────────────────────────────
// Motive fields are additive (instrument v2): optional, with array defaults, so
// they never block a save and v1 records validate unchanged.
const step4Object = z.object({
  medSob:    siNo.refine(v => v !== '', 'Responda esta pregunta'),
  dispMedVc: siNo,
  ctoDispVc: optStr,
  vtoMedNc:  siNo,
  cantMed:    z.number().int().min(0).nullable(),
  cantMedVto: z.number().int().min(0).nullable(),
  pesoMedNc:  z.number().min(0).nullable(),
  motNoConsumo:       z.array(z.string()),
  motNoConsumoOtro:   optStr,
  motVencimiento:     z.array(z.string()),
  motVencimientoOtro: optStr,
  dispFinal:          z.array(z.string()),
  dispFinalOtro:      optStr,
  conocePuntos:       siNo,
  cualPunto:          optStr,
})

// Picking "Otro" in a multi-select makes its free-text field required — the
// just-in-time rule the wizard surfaces inline when the "Otro" box reveals.
const step4Refine = (d: z.infer<typeof step4Object>, ctx: z.RefinementCtx) => {
  const reqOtro = (selected: string[], text: string, path: string, msg: string) => {
    if (selected?.includes('Otro') && !text?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: msg })
    }
  }
  reqOtro(d.motNoConsumo, d.motNoConsumoOtro, 'motNoConsumoOtro', 'Especifique el otro motivo de no consumo')
  reqOtro(d.motVencimiento, d.motVencimientoOtro, 'motVencimientoOtro', 'Especifique la otra razón de acumulación/vencimiento')
  reqOtro(d.dispFinal, d.dispFinalOtro, 'dispFinalOtro', 'Especifique la otra conducta de disposición')

  // Bloque de disposición obligatorio (Rec. 2): cuando el hogar guarda
  // medicamentos sin consumir (medSob='Sí'), las dos preguntas núcleo de
  // disposición deben responderse — su ausencia no aleatoria fue un hallazgo del
  // piloto. Solo aplican cuando ese bloque se muestra (medSob='Sí'), así que un
  // registro sin medicamentos (medSob='No') no queda bloqueado.
  if (d.medSob === 'Sí') {
    if (!d.dispMedVc) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dispMedVc'], message: 'Responda si sabe qué hacer con los vencidos' })
    }
    if (!d.vtoMedNc) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['vtoMedNc'], message: 'Responda si hay unidades vencidas entre lo almacenado' })
    }
  }
}

export const step4Schema = step4Object.superRefine(step4Refine)

// ─── Step 5 — Medicamentos (managed outside RHF, no schema needed) ────────
// The medication list is managed via local state in Step5 and merged into draft.

// ─── Types ────────────────────────────────────────────────────────────────
export type Step1Data = z.infer<typeof step1Schema>
export type Step2Data = z.infer<typeof step2Schema>
export type Step3Data = z.infer<typeof step3Schema>
export type Step4Data = z.infer<typeof step4Schema>

// ─── Full survey validation ───────────────────────────────────────────────
export const surveySchema = step1Schema
  .merge(step2Object)
  .merge(step3Schema)
  .merge(step4Object)
  .extend({ obs: optStr })
  .superRefine(nvPosgRefine)
  .superRefine(step4Refine)
