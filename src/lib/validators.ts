import { z } from 'zod'

const optStr  = z.string()
const siNo    = z.string()
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD inválido').or(z.literal(''))

// ─── Step 1 — Identificación ──────────────────────────────────────────────
export const step1Schema = z.object({
  fEta:   z.string().min(1, 'La fecha de la entrevista es obligatoria')
           .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD inválido'),
  nuiEtr: z.number()
            .int('Debe ser un entero')
            .positive('Debe ser un entero positivo'),
  nui:    z.number(),
})

// ─── Step 2 — Demografía ─────────────────────────────────────────────────
export const step2Schema = z.object({
  fNac:    z.string().min(1, 'La fecha de nacimiento es obligatoria')
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD inválido'),
  ciudad:  optStr,
  dir:     optStr,
  estrato: z.number().int().min(1).max(6).nullable().optional(),
  etnia:   z.string().min(1, 'Seleccione una opción'),
  asSalud: z.string().min(1, 'Seleccione el régimen de salud'),
  estLab:  z.string().min(1, 'Seleccione el estado laboral'),
  ingreso: z.string().min(1, 'Seleccione el rango de ingresos'),
  nvEstu:  z.string().min(1, 'Seleccione el nivel de estudios'),
  nvPosg:  optStr,   // Posgrado: opcional (solo aplica a quienes culminaron estudios superiores)
})

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
export const step4Schema = z.object({
  medSob:    siNo.refine(v => v !== '', 'Responda esta pregunta'),
  dispMedVc: siNo,
  ctoDispVc: optStr,
  vtoMedNc:  siNo,
  cantMed:    z.number().int().min(0).nullable(),
  cantMedVto: z.number().int().min(0).nullable(),
  pesoMedNc:  z.number().min(0).nullable(),
})

// ─── Step 5 — Medicamentos (managed outside RHF, no schema needed) ────────
// The medication list is managed via local state in Step5 and merged into draft.

// ─── Types ────────────────────────────────────────────────────────────────
export type Step1Data = z.infer<typeof step1Schema>
export type Step2Data = z.infer<typeof step2Schema>
export type Step3Data = z.infer<typeof step3Schema>
export type Step4Data = z.infer<typeof step4Schema>

// ─── Full survey validation ───────────────────────────────────────────────
export const surveySchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .extend({ obs: optStr })
