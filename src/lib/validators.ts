import { z } from 'zod'

// ─── Reusable primitives ──────────────────────────────────────────────────────

const siNo = z.string()
const optStr = z.string()

// ─── Step schemas ─────────────────────────────────────────────────────────────

export const step1Schema = z.object({
  fechaEncuesta: z.string().min(1, 'La fecha de la encuesta es obligatoria'),
  nuiEncuestador: z.string().min(1, 'El N° de identificación del encuestador es obligatorio'),
  nui: z.string(),
})

export const step2Schema = z.object({
  fechaNac: z
    .string()
    .min(1, 'La fecha de nacimiento es obligatoria')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  etnia: z.string().min(1, 'Seleccione una opción'),
  eps:   z.string().min(1, 'Seleccione el régimen de salud'),
  labor: z.string().min(1, 'Seleccione el estado laboral'),
  ingreso: z.string().min(1, 'Seleccione el rango de ingreso'),
  educ: z.string().min(1, 'Seleccione el nivel de estudios'),
})

export const step3Schema = z.object({
  perSalud: z.string().min(1, 'Indique la percepción de salud'),
  estSalud: siNo.refine(v => v !== '', 'Responda esta pregunta'),
  prbSalud: optStr,
  conMed:   siNo,
  medPrc:   siNo,
  indMed:   siNo,
})

export const step4Schema = z.object({
  medSob: siNo.refine(v => v !== '', 'Responda esta pregunta'),
  dispVenc: siNo,
  ctoDisp: optStr,
  hayVenc: siNo,
  cantMed:  z.number().int().min(0).nullable(),
  cantVenc: z.number().int().min(0).nullable(),
  pesoMed:  z.number().min(0).nullable(),
})

export const step5Schema = z.object({
  nmMed:   optStr,
  dci:     optStr,
  concMed: z.number().min(0).nullable(),
  undConc: optStr,
})

export type Step1Data = z.infer<typeof step1Schema>
export type Step2Data = z.infer<typeof step2Schema>
export type Step3Data = z.infer<typeof step3Schema>
export type Step4Data = z.infer<typeof step4Schema>
export type Step5Data = z.infer<typeof step5Schema>

// ─── Full survey validation ───────────────────────────────────────────────────

export const surveySchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .extend({ obs: optStr })
