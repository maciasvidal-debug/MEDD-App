import { C } from '../../components/ui'
import { type InsightTone } from '../../lib/insights'

// "Lectura rápida" auto-insights: the rule-based read-out lives in lib/insights
// (a non-component module) so this file stays Fast-Refresh-friendly; here we only
// render it.
export const INSIGHT_TONE: Record<InsightTone, { color: string; icon: string }> = {
  good: { color: C.green, icon: 'ti-circle-check' },
  warn: { color: C.amber, icon: 'ti-alert-triangle' },
  info: { color: C.teal,  icon: 'ti-info-circle' },
}
