import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, LabelList,
} from 'recharts'
import { C, CHART } from '../../components/ui'
import { pct } from '../../lib/utils'

export const tipStyle = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 9, padding: '7px 11px', fontSize: 12,
  boxShadow: '0 8px 24px -8px rgba(14, 23, 38, 0.22)',
}

export const CustomTip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { name: string } }> }) =>
  active && payload?.length
    ? <div style={tipStyle}><strong>{payload[0].payload.name}</strong>: {payload[0].value}</div>
    : null

// Single-line, width-aware Y-axis tick for the horizontal distribution bars.
// Recharts' default category tick word-wraps long labels (e.g. full commercial
// drug names / DCI strings) into several lines that overflow the ~30px row and
// collide with their neighbours. We truncate to one line that fits `width`
// (≈6.2px per char) and expose the full label via the native SVG <title>
// (hover) — the chart Tooltip also shows it on bar hover, so nothing is lost.
export const DistBarYTick = (props: {
  x?: number; y?: number; width?: number; payload?: { value: string | number }
}) => {
  const { x = 0, y = 0, width = 80, payload } = props
  const label = String(payload?.value ?? '')
  const maxChars = Math.max(6, Math.round(width / 6.2))
  const short = label.length > maxChars ? `${label.slice(0, maxChars - 1).trimEnd()}…` : label
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill={CHART.axis}>
      <title>{label}</title>{short}
    </text>
  )
}

export const MiniDonut = ({ val, outOf, label, color }: { val: number; outOf: number; label: string; color: string }) => {
  const data = [{ v: val }, { v: Math.max(0, outOf - val) }]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <PieChart width={72} height={72}>
        <Pie data={data} cx={36} cy={36} innerRadius={22} outerRadius={34} dataKey="v" stroke="none" cornerRadius={4} paddingAngle={data[0].v > 0 && data[1].v > 0 ? 2 : 0}>
          <Cell fill={color} />
          <Cell fill={CHART.track} />
        </Pie>
      </PieChart>
      <span className="fd tnum" style={{ fontSize: 18, fontWeight: 600, color }}>{pct(val, outOf)}%</span>
      <span style={{ fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
      <span style={{ fontSize: 11, color: C.hint }}>{val}/{outOf}</span>
    </div>
  )
}

// Horizontal distribution bars — one component for the six near-identical
// category charts. Premium touches applied once: gradient bar fill, rounded
// caps, clean axes (no spines/ticks), capped bar thickness.
export function DistBar({ data, dataKey = 'n', color, yWidth = 80, barName }: {
  data: Array<Record<string, string | number>>
  dataKey?: string
  color: string
  yWidth?: number
  barName?: string
}) {
  const gid = `bar-${color.replace('#', '')}`
  return (
    // Right margin reserves room for the inline value label at the end of the
    // longest bar so it isn't clipped.
    <div style={{ height: Math.max(80, data.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 34, top: 4, bottom: 0 }} barCategoryGap="22%">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          {/* Axis hidden: each bar is labelled with its value directly (readable
              at a glance and on touch, where there's no hover for the tooltip),
              so the numeric axis would just be chart-junk. Kept for domain calc. */}
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" tick={<DistBarYTick width={yWidth} />} width={yWidth} axisLine={false} tickLine={false} interval={0} />
          <Tooltip content={<CustomTip />} cursor={{ fill: CHART.track }} />
          <Bar dataKey={dataKey} fill={`url(#${gid})`} radius={[0, 5, 5, 0]} maxBarSize={26} name={barName}>
            {/* Literal colour: SVG fill can't resolve the CSS var() tokens. */}
            <LabelList dataKey={dataKey} position="right" fill={CHART.axis} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Plain-language glossary for the inline "¿Qué significa?" help ──────────
// Centralised so the same wording explains a statistic wherever it appears.
// Kept short and jargon-light: the investigator gets the gist here, the formal
// detail lives in the cards' own footnotes.
