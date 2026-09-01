/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import { Card, C } from '../../components/ui'
import { STAT_GLOSSARY } from '../../data/statGlossary'
import { SectionLabel } from './Navigation'
import {
  type AssocGroup, type Association, type SurveyorEffect, type SurveyorQC,
  type BackcheckAgreement, type AdjustedAssoc, type DaysSummary,
  type RbqmVerification, type HouseholdClustering
} from '../../lib/dashboard-metrics'
import type { Survey } from '../../types'
import { type HolmResult } from '../../lib/stats'

export const PValue = ({ p }: { p: number }) => (
  <span className="tnum" style={{ fontWeight: 600, color: p < 0.05 ? C.red : C.text }}>
    p{p < 0.001 ? '<0.001' : `=${(typeof p === 'number' && !Number.isNaN(p) ? p : 0).toFixed(3)}`}
  </span>
)

// ─── Retention time of expired medications (days-overdue distribution) ──────

export function RetentionCard({ s }: { s: DaysSummary }) {
  const scale = s.max > 0 ? s.max : 1
  const x = (v: number) => `${Math.min(100, (v / scale) * 100)}%`
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.retencion}>Tiempo de retención de medicamentos vencidos</SectionLabel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: C.muted }}>Mediana de días vencido</span>
        <span className="fd tnum" style={{ fontSize: 24, fontWeight: 600, color: C.amber }}>{Math.round(s.median)} d</span>
      </div>
      {/* IQR box (Q1–Q3) with the median marker, scaled 0..max */}
      <div style={{ position: 'relative', height: 10, background: C.bg, borderRadius: 5, margin: '6px 0' }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: x(s.q1), width: `calc(${x(s.q3)} - ${x(s.q1)})`,
          background: `${C.amber}40`, borderRadius: 5,
        }} />
        <div style={{
          position: 'absolute', top: -2, bottom: -2,
          left: `calc(${x(s.median)} - 1px)`, width: 2, background: C.amber,
        }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
        <DaysStat label="RIC (Q1–Q3)" value={`${Math.round(s.q1)}–${Math.round(s.q3)} d`} />
        <DaysStat label="Percentil 90" value={`${Math.round(s.p90)} d`} />
        <DaysStat label="Máximo" value={`${Math.round(s.max)} d`} />
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        Sobre {s.n} producto(s) vencido(s). Mide cuánto tiempo permanecen los medicamentos vencidos en el hogar — la ventana de riesgo sanitario y ambiental.
      </p>
    </Card>
  )
}

export function DaysStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: C.bg }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Exposure → outcome association (estrato gradient) ──────────────────────

export const fmtP = (p: number) => (p < 0.001 ? '< 0,001' : p.toFixed(3).replace('.', ','))

export function AssociationCard({ assoc }: { assoc: Association }) {
  const { groups, chi, trend, ref } = assoc
  const sig = chi.df > 0 && chi.p < 0.05
  const trendSig = trend !== null && trend.p < 0.05
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.asociacion}>Asociación: vencidos en casa según estrato</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {groups.map(g => <AssocRow key={g.label} g={g} />)}
      </div>
      <div style={{ marginTop: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        <strong style={{ color: sig ? C.amber : C.text }}>
          χ² = {chi.chi2.toFixed(2)} (gl {chi.df}), p = {fmtP(chi.p)}
        </strong>
        {' — '}
        {sig ? 'diferencia entre estratos significativa' : 'sin evidencia de diferencia'} (α = 0,05).
        {trend && (
          <div style={{ marginTop: 4 }}>
            <strong style={{ color: trendSig ? C.amber : C.text }}>
              Tendencia (Cochran–Armitage): χ² = {trend.chi2.toFixed(2)} (gl 1), p = {fmtP(trend.p)}
            </strong>
            {' — '}
            {trendSig
              ? `gradiente ${trend.direction} con el estrato`
              : 'sin gradiente monótono'}.
          </div>
        )}
        {chi.minExpected < 5 && (
          <div style={{ color: C.amber, marginTop: 4 }}>
            ⚠ Celda esperada &lt; 5: interpretar con cautela (preferir test exacto).
          </div>
        )}
        <div style={{ marginTop: 4, color: C.hint }}>
          Referencia: estrato {ref}. RP = razón de prevalencia vs. referencia (IC 95%).
        </div>
      </div>
    </Card>
  )
}

// ─── Surveyor (interviewer) effect — data-quality stratification ────────────

export function SurveyorEffectCard({ s }: { s: SurveyorEffect }) {
  const { programs, chi, ref, trend, nSemester, icc } = s
  const progSig = chi !== null && chi.df > 0 && chi.p < 0.05
  const trendSig = trend !== null && trend.p < 0.05
  const iccHigh = icc !== null && icc.icc >= 0.05
  const flagged = progSig || trendSig || iccHigh
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.icc}>Control de calidad — efecto del encuestador</SectionLabel>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Prevalencia de <strong>vencidos confirmados en casa</strong> según el perfil de quien
        recolectó. El desenlace no debería depender del encuestador: una diferencia marcada es
        señal de <strong>variabilidad de medición entre observadores</strong> (revisar criterios /
        capacitación), no de un efecto epidemiológico real.
      </p>

      {programs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {programs.map(g => <AssocRow key={g.label} g={g} />)}
        </div>
      )}

      <div style={{ marginTop: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        {chi && (
          <div>
            <strong style={{ color: progSig ? C.amber : C.text }}>
              Por programa · χ² = {chi.chi2.toFixed(2)} (gl {chi.df}), p = {fmtP(chi.p)}
            </strong>
            {' — '}
            {progSig
              ? 'difiere según el programa del encuestador (posible efecto del observador)'
              : 'sin evidencia de diferencia entre programas'} (α = 0,05).
            {chi.minExpected < 5 && (
              <span style={{ color: C.amber }}> ⚠ Celda esperada &lt; 5: interpretar con cautela.</span>
            )}
          </div>
        )}
        {trend && (
          <div style={{ marginTop: chi ? 6 : 0 }}>
            <strong style={{ color: trendSig ? C.amber : C.text }}>
              Por semestre (Cochran–Armitage) · χ² = {trend.chi2.toFixed(2)} (gl 1), p = {fmtP(trend.p)}
            </strong>
            {' — '}
            {trendSig
              ? `gradiente ${trend.direction} con el semestre académico (n = ${nSemester})`
              : `sin gradiente con el semestre (n = ${nSemester})`}.
          </div>
        )}
        {icc && (
          <div style={{ marginTop: (chi || trend) ? 6 : 0 }}>
            <strong style={{ color: iccHigh ? C.amber : C.text }}>
              ICC por encuestador = {icc.icc.toFixed(3)} (deff {icc.designEffect.toFixed(2)}, {icc.clusters} encuestadores)
            </strong>
            {' — '}
            {iccHigh
              ? 'parte de la variación del desenlace se explica por el encuestador (efecto de conglomerado relevante)'
              : 'variación entre encuestadores despreciable'}.
          </div>
        )}
        {programs && (
          <div style={{ marginTop: 4, color: C.hint }}>
            Referencia: {ref} (programa con más registros). RP = razón de prevalencia vs. referencia (IC 95%).
          </div>
        )}
        <div style={{ marginTop: 6, color: C.hint, fontSize: 11.5, lineHeight: 1.5 }}>
          ⚠ Los contrastes por programa y por semestre no ajustan por el agrupamiento
          de encuestas dentro de un mismo encuestador (que el ICC cuantifica): sus
          valores p pueden ser <strong>anticonservadores</strong>. Además, las diferencias
          entre encuestadores pueden reflejar que cada uno cubre <strong>zonas/poblaciones
          distintas</strong> (case-mix), no necesariamente sesgo del observador, salvo
          asignación aleatoria de encuestadores a zonas.
        </div>
        {!flagged && (
          <div style={{ marginTop: 4, color: C.green }}>
            ✓ Sin señal de efecto del encuestador con los datos actuales.
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Household clustering + sampling design (Rec. 5) ────────────────────────

export function HouseholdClusteringCard({ h }: { h: HouseholdClustering }) {
  const covPct = Math.round(h.coverage * 100)
  const noHogar = h.nWithHogar === 0
  const iccHigh = h.icc !== null && h.icc.icc >= 0.05
  const tiles: Array<{ v: string; label: string; accent?: string }> = [
    { v: `${covPct}%`, label: `con hogar_id (${h.nWithHogar}/${h.nSurveys})`, accent: noHogar ? C.amber : C.green },
    { v: String(h.nHouseholds), label: 'hogares identificados' },
    { v: h.meanSize ? h.meanSize.toFixed(1) : '—', label: 'encuestas/hogar (media)' },
    { v: String(h.multiPersonHouseholds), label: 'hogares multipersona' },
  ]
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.icc}>Diseño muestral — agrupamiento por hogar</SectionLabel>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        El agrupamiento por <strong>hogar</strong> sólo es modelable cuando el dato trae{' '}
        <code>hogar_id</code>. Este panel mide la <strong>cobertura</strong> del identificador
        (indicador de preparación para la próxima ola) y, cuando hay hogares identificados, su
        tamaño y el <strong>ICC</strong> del desenlace por hogar.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '10px 12px', background: C.bg, borderRadius: 8 }}>
        {tiles.map(t => (
          <div key={t.label} style={{ flex: 1, minWidth: 90 }}>
            <div className="fd tnum" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: t.accent ?? C.text }}>{t.v}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {h.icc && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          <strong style={{ color: iccHigh ? C.amber : C.text }}>
            ICC por hogar = {h.icc.icc.toFixed(3)} (deff {h.icc.designEffect.toFixed(2)}, {h.icc.clusters} hogares)
          </strong>
          {' — '}
          {iccHigh
            ? 'el desenlace se agrupa dentro de los hogares: el diseño debe corregir por efecto de conglomerado'
            : 'agrupamiento por hogar despreciable con los datos actuales'}.
        </div>
      )}

      {noHogar && (
        <div style={{ marginTop: 10, color: C.amber, fontSize: 11.5, lineHeight: 1.5 }}>
          ⚠ Ninguna encuesta del conjunto actual trae <code>hogar_id</code> (histórico del piloto).
          El asistente lo autogenera en cada captura nueva, así que la cobertura crecerá desde la próxima ola.
        </div>
      )}

    </Card>
  )
}

// ─── Per-surveyor operational QC (para-data / fraud monitoring) ─────────────

export function SurveyorQCCard({ qc }: { qc: SurveyorQC }) {
  const { rows, poolVencPct, digit } = qc
  const digitFlag = digit !== null && digit.p < 0.05
  const fmtPctN = (x: number) => `${(x * 100).toFixed(0)}%`
  const fmtDur = (d: number | null) =>
    d == null ? '—' : d >= 60 ? `${Math.floor(d / 60)}m ${Math.round(d % 60)}s` : `${Math.round(d)}s`
  const th: React.CSSProperties = { padding: '4px 6px' }
  const td: React.CSSProperties = { padding: '5px 6px' }
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.digit}>Control de calidad por encuestador (para-data / antifraude)</SectionLabel>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Señales operativas por encuestador para priorizar <strong>back-checks</strong>: completitud
        baja, exceso de respuestas planas (straightlining), entrevistas demasiado rápidas o
        prevalencias atípicas pueden indicar errores de captura o fabricación.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.muted, textAlign: 'right' }}>
              <th style={{ ...th, textAlign: 'left' }}>Encuestador</th>
              <th style={th}>n</th>
              <th style={th}>Compl.</th>
              <th style={th}>Plana</th>
              <th style={th}>%Venc</th>
              <th style={th}>Mediana</th>
              <th style={th}>Rápidas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const flag = r.straightPct >= 0.5 || r.fastCount > 0 || r.completeness < 0.7
              return (
                <tr key={r.nuiEtr} style={{ textAlign: 'right', color: flag ? C.amber : C.text, borderTop: `0.5px solid ${C.border}` }}>
                  <td style={{ ...td, textAlign: 'left' }}>#{r.nuiEtr}{flag ? ' ⚠' : ''}</td>
                  <td style={td} className="tnum">{r.n}</td>
                  <td style={td} className="tnum">{fmtPctN(r.completeness)}</td>
                  <td style={td} className="tnum">{fmtPctN(r.straightPct)}</td>
                  <td style={td} className="tnum">{fmtPctN(r.vencPct)}</td>
                  <td style={td} className="tnum">{fmtDur(r.medianDurSec)}</td>
                  <td style={td} className="tnum">{r.fastCount || '·'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
        Prevalencia de vencidos en el pool: <strong>{fmtPctN(poolVencPct)}</strong> (referencia para «%Venc»).
        {digit
          ? <> · Dígito terminal del peso (n = {digit.n}): χ² = {digit.chi2.toFixed(1)} (gl 9), p = {fmtP(digit.p)} — {digitFlag ? '⚠ posible redondeo/fabricación' : 'sin preferencia de dígito'}.</>
          : <> · Dígito terminal: datos insuficientes (n &lt; 20).</>}
        <div style={{ marginTop: 4, color: C.hint }}>
          «Plana» = % de encuestas con todas las respuestas Sí/No idénticas (≥3 ítems).
          «Rápidas» = entrevistas &lt; {180}s (heurístico); la duración solo está disponible
          desde esta versión. Estas señales orientan auditoría, no son prueba por sí solas.
        </div>
      </div>
    </Card>
  )
}

// ─── Data integrity: declared expired meds without expired-product detail ───

// Surfaces records flagged "has expired meds in the home" (vtoMedNc='Sí' or a
// positive expired-unit count) that carry no medication entry with a past
// expiry date. These can't be analysed at the product level and should be
// re-captured or back-checked. Investigator-only, read-only.
// Verificación RBQM (QC de solo lectura): una fila por control aplicado, con su
// valor y un semáforo. Verde = cumple; ámbar = no cumple pero tolerado por diseño
// (p. ej. histórico grandfathered, o variable v3 aún sin capturar); rojo = revisar.
export function RbqmVerificationCard({ v }: { v: RbqmVerification }) {
  const dist = v.versionDist.map(d => `v${d.version}: ${d.n}`).join(' · ')
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Verificación RBQM — controles aplicados</SectionLabel>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Estado de solo lectura de los controles de calidad sobre las <strong>{v.n}</strong> encuesta(s)
        en análisis. Distribución de versión del instrumento — {dist}.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {v.checks.map(c => {
          const color = c.ok ? C.green : (c.tolerated ? C.amber : C.red)
          const icon = c.ok ? 'ti-circle-check' : (c.tolerated ? 'ti-alert-triangle' : 'ti-circle-x')
          return (
            <div
              key={c.id}
              title={c.note ?? ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 0', borderBottom: `0.5px solid ${C.border}`,
              }}
            >
              <i className={`ti ${icon}`} style={{ fontSize: 16, color, flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: 12.5, color: C.text, flex: 1, minWidth: 0 }}>
                <span style={{ color: C.hint, fontWeight: 700, marginRight: 6 }}>{c.id}</span>
                {c.label}
                {c.note && (
                  <span style={{ display: 'block', fontSize: 11, color: C.muted, marginTop: 1 }}>{c.note}</span>
                )}
              </span>
              <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color, flexShrink: 0 }}>
                {c.display}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function IntegrityCard({ issues }: { issues: Survey[] }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel>Integridad — vencidos declarados sin detalle</SectionLabel>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        <strong style={{ color: C.amber }}>{issues.length}</strong> encuesta(s) marcan medicamentos
        vencidos en el hogar pero <strong>ningún producto</strong> tiene fecha de vencimiento pasada.
        No pueden analizarse a nivel de producto: priorizar corrección o back-check.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {issues.slice(0, 40).map(s => (
          <span
            key={s.id}
            title={`${s.ciudad || 'Sin ciudad'} · ${s.cantMedVto ?? 0} unidad(es) vencida(s) declarada(s)`}
            style={{
              fontSize: 12, fontWeight: 600, color: C.amber,
              background: C.amberLight, border: `1px solid ${C.amber}40`,
              borderRadius: 7, padding: '3px 8px',
            }}
          >
            #{String(s.nui).padStart(3, '0')}
          </span>
        ))}
        {issues.length > 40 && (
          <span style={{ fontSize: 12, color: C.hint, alignSelf: 'center' }}>
            +{issues.length - 40} más
          </span>
        )}
      </div>
    </Card>
  )
}

// ─── Back-check agreement (re-interview reliability / fraud check) ──────────

// Landis–Koch bands for κ.
export function kappaBand(k: number): { label: string; color: string } {
  if (k < 0.2) return { label: 'pobre', color: C.red }
  if (k < 0.4) return { label: 'débil', color: C.amber }
  if (k < 0.6) return { label: 'moderada', color: C.amber }
  if (k < 0.8) return { label: 'buena', color: C.teal }
  return { label: 'muy buena', color: C.green }
}

export function BackcheckAgreementCard({ a }: { a?: BackcheckAgreement }) {
  if (!a || typeof a.kappaBin?.kappa !== 'number' || Number.isNaN(a.kappaBin?.kappa)) return null;
  const { nPairs, kappaBin, catAgreement, pesoMAD } = a
  const band = kappaBin ? kappaBand(kappaBin.kappa) : null
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.kappa}>Concordancia de back-check</SectionLabel>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Compara las re-entrevistas de control con su encuesta original sobre{' '}
        <strong>{nPairs}</strong> par(es). Baja concordancia indica variabilidad de
        interpretación (capacitación) o, en casos extremos, fabricación.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: C.bg, border: `1px solid ${band ? band.color : C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>κ ítems Sí/No</div>
          <div className="fd tnum" style={{ fontSize: 22, fontWeight: 600, color: band ? band.color : C.text, lineHeight: 1 }}>
            {kappaBin ? kappaBin.kappa.toFixed(2) : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.hint, marginTop: 3 }}>{band ? band.label : 'sin datos'}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Acuerdo categórico</div>
          <div className="fd tnum" style={{ fontSize: 22, fontWeight: 600, color: C.text, lineHeight: 1 }}>
            {catAgreement != null ? `${(catAgreement * 100).toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.hint, marginTop: 3 }}>ítems coincidentes</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '10px 8px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Δ peso (MAD)</div>
          <div className="fd tnum" style={{ fontSize: 22, fontWeight: 600, color: C.text, lineHeight: 1 }}>
            {pesoMAD != null ? `${pesoMAD.toFixed(1)} g` : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.hint, marginTop: 3 }}>dif. media abs.</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
        κ corregido por azar (bandas de Landis–Koch). Inicia un back-check desde
        «Registros» (vista de tarjetas) con el botón de control. Con pocos pares, interpretar como orientativo.
      </div>
    </Card>
  )
}

// ─── Confounding-adjusted association (Mantel–Haenszel) ─────────────────────

export function AdjustedAssociationCard({ a }: { a: AdjustedAssoc }) {
  const { crude, mh, bd, exposedTotal, unexposedTotal, pctChange } = a
  const confounded = pctChange >= 10
  const adjSig = mh.lo > 1 || mh.hi < 1
  const heterog = bd !== null && bd.p < 0.05
  const fmt = (x: number) => x.toFixed(2)
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.mh}>Asociación ajustada por confusión (Mantel–Haenszel)</SectionLabel>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Exposición: <strong>estrato medio–alto (3–6)</strong> vs bajo (1–2). Desenlace:
        <strong> vencidos confirmados en casa</strong>. Ajustada por el <strong>programa del
        encuestador</strong> ({mh.strata} estratos).
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <RRBox label="RP cruda" rr={crude.rr} lo={crude.lo} hi={crude.hi} fmt={fmt} />
        <RRBox label="RP ajustada (MH)" rr={mh.rr} lo={mh.lo} hi={mh.hi} fmt={fmt} highlight />
      </div>

      <div style={{ marginTop: 10, padding: '8px 10px', background: C.bg, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        <strong style={{ color: adjSig ? C.amber : C.text }}>
          CMH χ² = {mh.chi2.toFixed(2)} (gl 1), p = {fmtP(mh.p)}
        </strong>
        {' — '}
        {adjSig ? 'asociación significativa tras ajustar' : 'sin asociación tras ajustar'} (α = 0,05).
        <div style={{ marginTop: 4, color: confounded ? C.amber : C.green }}>
          {confounded
            ? `⚠ La estimación cambia ${pctChange.toFixed(0)}% al ajustar → el programa del encuestador confunde la asociación.`
            : `✓ El ajuste apenas cambia la estimación (${pctChange.toFixed(0)}%) → sin confusión apreciable por el encuestador.`}
        </div>
        {bd && (
          <div style={{ marginTop: 4, color: heterog ? C.amber : C.green }}>
            Homogeneidad (Breslow–Day) · χ² = {bd.chi2.toFixed(2)} (gl {bd.df}), p = {fmtP(bd.p)} —{' '}
            {heterog
              ? '⚠ el efecto del estrato varía entre programas (modificación de efecto): la RP combinada puede no ser apropiada.'
              : 'la asociación es homogénea entre estratos → la estimación combinada es válida.'}
          </div>
        )}
        <div style={{ marginTop: 4, color: C.hint }}>
          n: {exposedTotal} expuestos (alto) · {unexposedTotal} no expuestos (bajo).
          Estrato dicotomizado; con celdas pequeñas, interpretar con cautela.
        </div>
      </div>
    </Card>
  )
}

// Exploratory-analysis disclaimer + family-wise (Holm) control over the panel's
// inferential contrasts, so multiple unadjusted p-values aren't over-read.
export function StatNotesCard({ tests, holm }: {
  tests: { key: string; label: string; p: number }[]
  holm: HolmResult[]
}) {
  if (tests.length === 0) return null
  const labelOf = new Map(tests.map(t => [t.key, t.label]))
  const anySurvive = holm.some(h => h.reject)
  return (
    <Card style={{ marginBottom: 14 }}>
      <SectionLabel help={STAT_GLOSSARY.holm}>Notas estadísticas — análisis exploratorio</SectionLabel>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Este panel es <strong>exploratorio / generador de hipótesis</strong>: con tamaños de
        muestra de campo y múltiples contrastes, los valores p sin ajustar inflan el error
        tipo I. La tabla aplica la corrección de <strong>Holm–Bonferroni</strong> (control del
        error por familia, α = 0,05) sobre los {tests.length} contraste(s) mostrados.
      </p>
      {tests.length >= 2 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {holm.map(h => (
            <div key={h.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
              <span style={{ color: C.text, flex: 1, minWidth: 0 }}>{labelOf.get(h.key) ?? h.key}</span>
              <span className="tnum" style={{ color: C.hint, flexShrink: 0 }}>p = {fmtP(h.p)}</span>
              <span className="tnum" style={{ color: h.reject ? C.amber : C.muted, fontWeight: 600, minWidth: 110, textAlign: 'right', flexShrink: 0 }}>
                Holm {fmtP(h.pAdj)} {h.reject ? '✓' : '·'}
              </span>
            </div>
          ))}
          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.hint, lineHeight: 1.5 }}>
            «✓» = sobrevive a la corrección por multiplicidad. Algunos contrastes son vistas
            alternativas de la misma hipótesis (p. ej. χ² y tendencia de estrato), por lo que
            Holm aquí es conservador.
            {!anySurvive && ' Con los datos actuales, ningún contraste sobrevive a la corrección.'}
          </p>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: C.hint }}>
          Un solo contraste disponible: sin ajuste por multiplicidad necesario.
        </p>
      )}
    </Card>
  )
}

export function RRBox({ label, rr, lo, hi, fmt, highlight }: {
  label: string; rr: number; lo: number; hi: number; fmt: (x: number) => string; highlight?: boolean
}) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 10,
      background: highlight ? C.tealLight : C.bg,
      border: `1px solid ${highlight ? C.teal : C.border}`,
    }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div className="fd tnum" style={{ fontSize: 24, fontWeight: 600, color: highlight ? C.teal : C.text, lineHeight: 1 }}>
        {fmt(rr)}
      </div>
      <div className="tnum" style={{ fontSize: 11, color: C.hint, marginTop: 3 }}>
        IC95% {fmt(lo)}–{fmt(hi)}
      </div>
    </div>
  )
}

export function AssocRow({ g }: { g: AssocGroup }) {
  const fmt = (x: number) => (x * 100).toFixed(1)
  const sig = !g.rr.ref && (g.rr.lo > 1 || g.rr.hi < 1)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 13, color: C.text }}>
        Estrato {g.label} <span style={{ fontSize: 11, color: C.hint }}>(n = {g.total})</span>
      </span>
      <span style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>{fmt(g.prev.p)}%</span>
        <span style={{ fontSize: 11, color: sig ? C.amber : C.muted, minWidth: 118, textAlign: 'right' }}>
          {g.rr.ref ? 'referencia' : `RP ${g.rr.rr.toFixed(2)} [${g.rr.lo.toFixed(2)}–${g.rr.hi.toFixed(2)}]`}
        </span>
      </span>
    </div>
  )
}
