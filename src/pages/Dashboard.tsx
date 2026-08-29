import { useMemo, useState } from 'react'
import { TopBar } from '../components/layout'
import { StatCard, Card, Button, EmptyState, C, CHART } from '../components/ui'
import { useStore } from '../lib/store'
import { useShallow } from 'zustand/react/shallow'
import { wilsonCI, holmAdjust } from '../lib/stats'
import { dateTag } from '../lib/date'
import { toCSV } from '../lib/csv'
import { pct, downloadBlob } from '../lib/utils'
import { buildInsights } from '../lib/insights'
import { buildTextAnalysis } from '../lib/text-analysis'
import { normalizeCiudad, fold } from '../lib/ciudad'
import { OPT } from '../lib/constants'
import { declaresExpiredWithoutDetail } from '../lib/quality'
import {
  buildRetention, buildEstratoAssociation, buildSurveyorEffect, buildSurveyorQC,
  buildMedicationStats, buildMotiveStats, buildDisposalStats, buildClassMotiveCross,
  buildBackcheckAgreement, buildEstratoAdjusted,
  buildHouseholdClustering, buildRbqmVerification,

} from '../lib/dashboard-metrics'


import {
  DistBar, MiniDonut, InvestigadorHero, EncuestadorHero, DashboardSectionNav, type NavSection,
  FilterBar, SectionAnchor, SectionLabel, QuickReadCard, PrevalenceCard, AssociationCard,
  SurveyorEffectCard, SurveyorQCCard, HouseholdClusteringCard, RbqmVerificationCard, IntegrityCard,
  BackcheckAgreementCard, AdjustedAssociationCard, RetentionCard, StatNotesCard, MedicationStatsCard,
  MotivesCard, DisposalCard, ClassMotiveCard, ObsFieldCard, DiscourseCard, HermeneuticCard
} from './dashboard'

export default function DashboardPage() {
  // ⚡ Bolt: subscribe only to the slices this view needs (via useShallow) instead
  // of the whole store. The Dashboard is the heaviest view to render (≈6 Recharts
  // ResponsiveContainers + 3 PieCharts), and a bare `useStore()` re-rendered all of
  // them on *any* state change — notably every transient toast push/auto-remove
  // (e.g. the "Sincronizado…" toast after a background sync) and every `syncing`
  // toggle, none of which affect the charts. Selecting only these fields lets the
  // whole chart tree bail out of those unrelated re-renders (actions are stable
  // refs; data fields compared shallowly).
  const { surveys, openWizard, userRole, setView, pendingDraft, resumeDraft } = useStore(
    useShallow(s => ({
      surveys: s.surveys,
      openWizard: s.openWizard,
      userRole: s.userRole,
      setView: s.setView,
      pendingDraft: s.pendingDraft,
      resumeDraft: s.resumeDraft,
    })),
  )
  const isInvestigador = userRole === 'investigador'

  // Investigator cockpit filters (encuestadores see only their own data, unfiltered)
  const [fCiudad, setFCiudad]   = useState('')
  const [fSalud, setFSalud]     = useState('')
  const [fEstrato, setFEstrato] = useState<number | null>(null)
  const [fProg, setFProg]       = useState('')
  const [fTipo, setFTipo]       = useState('')
  const filtersActive = isInvestigador && (!!fCiudad || !!fSalud || fEstrato !== null || !!fProg || !!fTipo)
  const clearFilters = () => { setFCiudad(''); setFSalud(''); setFEstrato(null); setFProg(''); setFTipo('') }

  // Cities present in the data, for the filter dropdown.
  const ciudadOptions = useMemo(
    () => Array.from(new Set(surveys.map(s => s.ciudad).filter(Boolean))).sort() as string[],
    [surveys],
  )
  // Surveyor academic programs present in the data.
  const progOptions = useMemo(
    () => Array.from(new Set(surveys.map(s => s.etrPrograma).filter(Boolean))).sort() as string[],
    [surveys],
  )

  const data = useMemo(() => {
    if (!isInvestigador) return surveys
    return surveys.filter(s =>
      (!fCiudad || s.ciudad === fCiudad) &&
      (!fSalud || s.asSalud === fSalud) &&
      (fEstrato === null || s.estrato === fEstrato) &&
      (!fProg || s.etrPrograma === fProg) &&
      (!fTipo || s.etrTipoInst === fTipo)
    )
  }, [surveys, isInvestigador, fCiudad, fSalud, fEstrato, fProg, fTipo])

  const n = data.length

  const {
    nSob, nVenc, nDisp, pesoTotal, unidTotal, vencTotal, totalMeds,
    barAsSalud, barNvEstu, barNvPosg, barEtnia, barEstrato, ciudadVenc
  } = useMemo(() => {
    let nSob = 0, nVenc = 0, nDisp = 0
    let pesoTotal = 0, unidTotal = 0, vencTotal = 0, totalMeds = 0

    const asSaludCounts: Record<string, number> = {}
    const nvEstuCounts: Record<string, number> = {}
    const nvPosgCounts: Record<string, number> = {}
    const etniaCounts: Record<string, number> = {}
    const estratoCounts: Record<number, number> = {}
    const ciudadVencMap = new Map<string, { label: string; value: number }>()

    // ⚡ Bolt: Single pass for scalar KPIs and distributions (reduces 21+ array passes to 1)
    for (let i = 0; i < data.length; i++) {
      const s = data[i]
      if (s.medSob === 'Sí') nSob++
      if (s.vtoMedNc === 'Sí') nVenc++
      if (s.dispMedVc === 'Sí') nDisp++
      pesoTotal += s.pesoMedNc ?? 0
      unidTotal += s.cantMed ?? 0
      vencTotal += s.cantMedVto ?? 0
      totalMeds += s.medications?.length ?? 0

      if (s.asSalud) asSaludCounts[s.asSalud] = (asSaludCounts[s.asSalud] || 0) + 1
      if (s.nvEstu) nvEstuCounts[s.nvEstu] = (nvEstuCounts[s.nvEstu] || 0) + 1
      if (s.nvPosg) nvPosgCounts[s.nvPosg] = (nvPosgCounts[s.nvPosg] || 0) + 1
      if (s.etnia) etniaCounts[s.etnia] = (etniaCounts[s.etnia] || 0) + 1
      if (s.estrato !== null && s.estrato !== undefined) estratoCounts[s.estrato] = (estratoCounts[s.estrato] || 0) + 1

      // Group by the canonical municipality key so casing/accents/appended
      // department don't split one city into several false "hotspots".
      const { municipio } = normalizeCiudad(s.ciudad)
      const key = fold(municipio)
      if (key) {
        const cur = ciudadVencMap.get(key) ?? { label: municipio, value: 0 }
        cur.value += (s.cantMedVto ?? 0)
        ciudadVencMap.set(key, cur)
      }
    }

    const barAsSalud = OPT.asSalud.map(v => ({ name: v, n: asSaludCounts[v] || 0 })).filter(d => d.n > 0)
    const barNvEstu  = OPT.nvEstu.map(v => ({ name: v, n: nvEstuCounts[v] || 0 })).filter(d => d.n > 0)
    const barNvPosg  = OPT.nvPosg.map(v => ({ name: v, n: nvPosgCounts[v] || 0 })).filter(d => d.n > 0)
    const barEtnia   = OPT.etnia.map(v => ({ name: v, n: etniaCounts[v] || 0 })).filter(d => d.n > 0)
    const barEstrato = OPT.estrato.map(e => ({ name: `Estrato ${e}`, n: estratoCounts[e] || 0 })).filter(d => d.n > 0)

    const ciudadVenc = Array.from(ciudadVencMap.values())
      .map(({ label, value }) => ({ name: label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    return {
      nSob, nVenc, nDisp, pesoTotal, unidTotal, vencTotal, totalMeds,
      barAsSalud, barNvEstu, barNvPosg, barEtnia, barEstrato, ciudadVenc
    }
  }, [data])

  const assoc = useMemo(() => buildEstratoAssociation(data), [data])
  const retention = useMemo(() => buildRetention(data), [data])
  const surveyorEffect = useMemo(() => buildSurveyorEffect(data), [data])
  const surveyorQC = useMemo(() => buildSurveyorQC(data), [data])
  const household = useMemo(() => buildHouseholdClustering(data), [data])
  // Verificación RBQM (solo lectura): evidencia agregada de que los controles
  // aplicados están surtiendo efecto sobre el dato que ve el investigador.
  const rbqm = useMemo(() => buildRbqmVerification(data), [data])
  // Product-level (medications[]) aggregation — the analytics that were missing.
  const medStats = useMemo(() => buildMedicationStats(data), [data])
  // Motives battery (instrument v2) — denominator scoped to records that were
  // actually asked, keeping "not asked" (v1) out of the percentages.
  const motiveStats = useMemo(() => buildMotiveStats(data), [data])
  // Therapeutic class × non-consumption motive contingency (hypothesis view).
  const classMotive = useMemo(() => buildClassMotiveCross(data), [data])
  // Disposal behaviour unified across v1 (free-text ctoDispVc) and v2 (dispFinal).
  const disposal = useMemo(() => buildDisposalStats(data), [data])
  // Records that declare expired meds in the home but carry no expired-product
  // detail — the integrity gap surfaced for follow-up / back-check.
  const integrityIssues = useMemo(() => data.filter(declaresExpiredWithoutDetail), [data])
  const backcheck = useMemo(() => buildBackcheckAgreement(data), [data])
  const adjusted = useMemo(() => buildEstratoAdjusted(data), [data])

  // Family of inferential contrasts shown on this panel, for a family-wise
  // (Holm–Bonferroni) view that surfaces which survive multiple-comparison
  // control. Breslow–Day and the expected-cell check are diagnostics, not part
  // of the hypothesis family, so they're excluded here.
  const inferentialTests = useMemo(() => {
    const t: { key: string; label: string; p: number }[] = []
    if (assoc) {
      if (assoc.chi.df > 0) t.push({ key: 'estrato-chi', label: 'Estrato × vencidos (χ²)', p: assoc.chi.p })
      if (assoc.trend)      t.push({ key: 'estrato-trend', label: 'Gradiente por estrato (Cochran–Armitage)', p: assoc.trend.p })
    }
    if (surveyorEffect) {
      if (surveyorEffect.chi && surveyorEffect.chi.df > 0) t.push({ key: 'prog-chi', label: 'Programa del encuestador × vencidos (χ²)', p: surveyorEffect.chi.p })
      if (surveyorEffect.trend) t.push({ key: 'sem-trend', label: 'Gradiente por semestre (Cochran–Armitage)', p: surveyorEffect.trend.p })
    }
    if (adjusted) t.push({ key: 'cmh', label: 'Asociación ajustada estrato→vencidos (CMH)', p: adjusted.mh.p })
    return t
  }, [assoc, surveyorEffect, adjusted])
  const holm = useMemo(() => holmAdjust(inferentialTests), [inferentialTests])

  // Qualitative text analysis: discourse + hermeneutic layers over the obs field.
  // Only computed for the investigador (no obs access in encuestador mode).
  const textAnalysis = useMemo(
    () => isInvestigador ? buildTextAnalysis(data) : null,
    [data, isInvestigador],
  )

  // Plain-language read-out: synthesises the above into first-pass insights.
  const insights = useMemo(() => buildInsights({
    n, nSob, nVenc, nDisp, unidTotal, vencTotal,
    assoc, surveyorEffect, adjusted, backcheck, retention, medStats,
    integrityCount: integrityIssues.length, tests: inferentialTests, holm,
  }), [n, nSob, nVenc, nDisp, unidTotal, vencTotal, assoc, surveyorEffect, adjusted, backcheck, retention, medStats, integrityIssues, inferentialTests, holm])

  // Wayfinding index for the sticky section nav — lists only the blocks that
  // actually render for this dataset/role, in DOM order. Keyed by the same
  // presence conditions used in the JSX below so a chip never jumps to nothing.
  const sections = useMemo<NavSection[]>(() => {
    const list: NavSection[] = [{ id: 'sec-resumen', label: 'Resumen', icon: 'ti-layout-dashboard' }]
    if (medStats || motiveStats || disposal || classMotive)
      list.push({ id: 'sec-medicamentos', label: 'Medicamentos', icon: 'ti-pill' })
    list.push({ id: 'sec-inferencia', label: 'Prevalencia', icon: 'ti-chart-dots' })
    if (surveyorEffect || adjusted || retention ||
        (isInvestigador && (rbqm || surveyorQC || integrityIssues.length > 0 || backcheck)))
      list.push({ id: 'sec-calidad', label: 'Calidad', icon: 'ti-shield-check' })
    if (ciudadVenc.length || barEstrato.length || barAsSalud.length ||
        barNvEstu.length || barNvPosg.length || barEtnia.length)
      list.push({ id: 'sec-distribuciones', label: 'Distribuciones', icon: 'ti-chart-bar' })
    if (isInvestigador && textAnalysis)
      list.push({ id: 'sec-cualitativo', label: 'Cualitativo', icon: 'ti-message-2' })
    return list
  }, [medStats, motiveStats, disposal, classMotive, surveyorEffect, adjusted, retention,
      isInvestigador, rbqm, surveyorQC, integrityIssues.length, backcheck, textAnalysis,
      ciudadVenc.length, barEstrato.length, barAsSalud.length, barNvEstu.length, barNvPosg.length, barEtnia.length])

  // No data at all (vs. "filters returned nothing", handled further down)
  if (surveys.length === 0) {
    return (
      <div>
        <TopBar title="Panel analítico" icon="ti-layout-dashboard" accent={C.navy} />
        <div className="page-content">
          <EmptyState
            icon="ti-clipboard-data"
            title={isInvestigador ? 'Aún no hay datos' : 'Sin encuestas aún'}
            description={isInvestigador
              ? 'Cuando los encuestadores registren encuestas, aquí verás el análisis agregado.'
              : 'Registra tu primera encuesta para empezar a ver indicadores.'}
            action={isInvestigador ? undefined : (
              <Button onClick={() => openWizard(0)} icon="ti-plus">
                Registrar primera encuesta
              </Button>
            )}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar
        title={isInvestigador ? 'Panel analítico' : 'Mi panel'}
        subtitle={isInvestigador ? `${n} encuesta${n !== 1 ? 's' : ''} en análisis` : undefined}
        icon="ti-layout-dashboard"
        accent={C.navy}
      />

      {/* Sticky section navigator — a sibling of the TopBar (NOT inside
          .page-content, whose overflow:auto would trap the sticky and let it
          scroll away). Sits just below the header once the page is long enough
          to get lost in (≥3 sections present). */}
      {n > 0 && sections.length >= 3 && <DashboardSectionNav sections={sections} />}

      <div className="page-content">

        {/* Role-adaptive hero */}
        {isInvestigador
          ? <InvestigadorHero n={n} nVenc={nVenc} vencTotal={vencTotal} filtersActive={filtersActive} totalSurveys={surveys.length} />
          : <EncuestadorHero
              n={n} pendingDraft={!!pendingDraft}
              onNew={() => openWizard(surveys.length)}
              onResume={resumeDraft}
              onView={() => setView('encuestas')}
            />}

        {/* Investigator cockpit filters */}
        {isInvestigador && (
          <FilterBar
            ciudadOptions={ciudadOptions}
            progOptions={progOptions}
            fCiudad={fCiudad} setFCiudad={setFCiudad}
            fSalud={fSalud}   setFSalud={setFSalud}
            fEstrato={fEstrato} setFEstrato={setFEstrato}
            fProg={fProg}     setFProg={setFProg}
            fTipo={fTipo}     setFTipo={setFTipo}
            filtersActive={filtersActive} onClear={clearFilters}
            exportCount={n}
            onExport={() => downloadBlob(
              toCSV(data),
              `MEDD_${filtersActive ? 'filtrado_' : ''}${dateTag()}.csv`,
              'text/csv;charset=utf-8',
            )}
          />
        )}

        {/* Filtered-empty state (data exists but filters exclude everything) */}
        {n === 0 ? (
          <Card style={{ textAlign: 'center', padding: '32px 20px' }}>
            <i className="ti ti-filter-off" style={{ fontSize: 28, color: C.muted, display: 'block', marginBottom: 8 }} aria-hidden />
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px' }}>Ningún registro coincide con los filtros.</p>
            <Button variant="secondary" size="sm" icon="ti-x" onClick={clearFilters}>Limpiar filtros</Button>
          </Card>
        ) : (
        <>
        {/* KPIs */}
        <SectionAnchor id="sec-resumen" />
        <p style={{ fontSize: 11, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Indicadores clave · {n} encuesta{n !== 1 ? 's' : ''}
        </p>
        <div className="kpi-grid" style={{ marginBottom: 16 }}>
          <StatCard icon="ti-users"          label="Total encuestados"    value={n}                                  color={C.navy} />
          <StatCard icon="ti-pill"           label="Productos registrados" value={totalMeds}                          color={C.teal} />
          <StatCard icon="ti-package"        label="Unidades sin consumir" value={unidTotal}                          color={C.teal} />
          <StatCard icon="ti-alert-triangle" label="Unidades vencidas"    value={vencTotal}  sub={`${pct(vencTotal,unidTotal)}%`} color={C.amber} />
          <StatCard icon="ti-scale"          label="Peso total (g)"       value={pesoTotal.toFixed(1)}               color={C.gray} />
          <StatCard icon="ti-map-pin"        label="Con vencidos conf."   value={nVenc}      sub={`${pct(nVenc,n)}%`}             color={C.red} />
        </div>

        {/* Donuts */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel>Variables clave de resultado</SectionLabel>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <MiniDonut val={nSob}  outOf={n}    label="Med. sin consumir"   color={CHART.navy} />
            <MiniDonut val={nVenc} outOf={n}    label="Vencidos conf."      color={CHART.amber} />
            <MiniDonut val={nDisp} outOf={nSob} label="Conoce disposición*" color={CHART.teal} />
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: C.hint, textAlign: 'center', lineHeight: 1.5 }}>
            «Med. sin consumir» y «Vencidos conf.» sobre el total ({n} hogares).
            <br />*«Conoce disposición» se calcula solo sobre los {nSob} hogares que almacenan medicamentos.
          </p>
        </Card>

        {/* Lectura rápida — interpretación automática (primeros insights) */}
        <QuickReadCard insights={insights} />

        {/* Analítica a nivel de medicamento (producto) */}
        <SectionAnchor id="sec-medicamentos" />
        {medStats && <MedicationStatsCard s={medStats} />}

        {/* Motivos de no consumo / acumulación y disposición (instrumento v2) */}
        {motiveStats && <MotivesCard s={motiveStats} />}

        {/* Conducta de disposición unificada (v1 texto libre + v2 estructurado) */}
        {disposal && <DisposalCard d={disposal} />}

        {/* Cruce clase terapéutica × motivo de no consumo */}
        {classMotive && <ClassMotiveCard c={classMotive} />}

        {/* Prevalencias con incertidumbre */}
        <SectionAnchor id="sec-inferencia" />
        <PrevalenceCard
          rows={[
            { label: 'Almacena medicamentos sin consumir', ci: wilsonCI(nSob, n) },
            { label: 'Tiene vencidos confirmados en casa', ci: wilsonCI(nVenc, n) },
            { label: 'Conoce disposición (entre quienes almacenan)', ci: wilsonCI(nDisp, nSob) },
          ]}
        />

        {/* Asociación exposición–desenlace */}
        {assoc && <AssociationCard assoc={assoc} />}

        {/* Control de calidad: efecto del encuestador */}
        <SectionAnchor id="sec-calidad" />

        {/* Verificación RBQM (solo lectura): estado de los controles aplicados */}
        {isInvestigador && rbqm && <RbqmVerificationCard v={rbqm} />}

        {surveyorEffect && <SurveyorEffectCard s={surveyorEffect} />}

        {/* Control de calidad operativo por encuestador (para-data / antifraude) */}
        {isInvestigador && surveyorQC && <SurveyorQCCard qc={surveyorQC} />}

        {/* Diseño muestral: agrupamiento por hogar */}
        {isInvestigador && household && (
          <HouseholdClusteringCard h={household} />
        )}

        {/* Integridad: vencidos declarados sin detalle de producto vencido */}
        {isInvestigador && integrityIssues.length > 0 && <IntegrityCard issues={integrityIssues} />}

        {/* Concordancia de back-check (fiabilidad inter-observador) */}
        {isInvestigador && backcheck && <BackcheckAgreementCard a={backcheck} />}

        {/* Asociación ajustada por confusión (Mantel–Haenszel) */}
        {adjusted && <AdjustedAssociationCard a={adjusted} />}

        {/* Tiempo de retención de vencidos */}
        {retention && <RetentionCard s={retention} />}

        {/* Notas estadísticas: naturaleza exploratoria + control de multiplicidad */}
        <StatNotesCard tests={inferentialTests} holm={holm} />

        {/* Distribuciones — 2 columnas en pantallas anchas para aprovechar el espacio */}
        <SectionAnchor id="sec-distribuciones" />
        <div className="chart-grid">
        {/* Hotspots geográficos: CIUDAD x CANT_MED_VTO */}
        {ciudadVenc.length > 0 && (
          <Card>
            <SectionLabel>Hotspots geográficos — Unidades vencidas por ciudad</SectionLabel>
            <DistBar data={ciudadVenc} dataKey="value" color={CHART.amber} yWidth={85} barName="Unidades vencidas" />
          </Card>
        )}

        {/* ESTRATO distribution */}
        {barEstrato.length > 0 && (
          <Card>
            <SectionLabel>Distribución por estrato socioeconómico</SectionLabel>
            <DistBar data={barEstrato} color={CHART.navy} yWidth={75} />
          </Card>
        )}

        {/* AS_SALUD */}
        {barAsSalud.length > 0 && (
          <Card>
            <SectionLabel>Distribución por régimen de salud</SectionLabel>
            <DistBar data={barAsSalud} color={CHART.teal} yWidth={90} />
          </Card>
        )}

        {/* NV_ESTU */}
        {barNvEstu.length > 0 && (
          <Card>
            <SectionLabel>Distribución por nivel educativo</SectionLabel>
            <DistBar data={barNvEstu} color={CHART.purple} yWidth={75} />
          </Card>
        )}

        {/* NV_POSG */}
        {barNvPosg.length > 0 && (
          <Card>
            <SectionLabel>Distribución por nivel de posgrado</SectionLabel>
            <DistBar data={barNvPosg} color={CHART.violet} yWidth={95} />
          </Card>
        )}

        {/* Etnia */}
        {barEtnia.length > 0 && (
          <Card>
            <SectionLabel>Distribución por pertenencia étnica</SectionLabel>
            <DistBar data={barEtnia} color={CHART.gray} yWidth={120} />
          </Card>
        )}
        </div>

        {/* ── Análisis cualitativo de texto libre ─────────────────────────── */}
        {isInvestigador && textAnalysis && (
          <>
            <SectionAnchor id="sec-cualitativo" />
            <p style={{ fontSize: 11, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '20px 0 8px' }}>
              Análisis cualitativo · observaciones de campo
            </p>
            <ObsFieldCard result={textAnalysis} surveys={data} />
            {textAnalysis.nWithObs > 0 && (
              <>
                <DiscourseCard result={textAnalysis} />
                <HermeneuticCard result={textAnalysis} />
              </>
            )}
          </>
        )}

        </>
        )}
      </div>
    </div>
  )
}


