import type { CiiScore } from '../types'

const SEVERITY_STYLES: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500' },
  low: { color: 'text-green-400', bg: 'bg-green-500' },
}

function SeverityDot({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      <span className={`w-2 h-2 rounded-full ${style.bg}`} />
      <span className={`text-xs ${style.color}`}>{severity}</span>
    </span>
  )
}

interface CiiPanelProps {
  scores: CiiScore[]
}

export default function CiiPanel({ scores }: CiiPanelProps) {
  const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 20)

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold text-white mb-2">Country Instability Index</h2>
      <p className="text-[11px] text-gray-500">
        Composite risk score (0-100) from conflict, disaster, cyber, severe weather and news signals.
      </p>
      {top.length === 0 && <p className="text-xs text-gray-500">No scores yet.</p>}
      {top.map(s => {
        const style = SEVERITY_STYLES[s.severity] || SEVERITY_STYLES.low
        return (
          <div key={s.country} className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-200">{s.country}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-gray-100">{s.score.toFixed(1)}</span>
                <SeverityDot severity={s.severity} />
              </div>
            </div>
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${s.score}%` }} />
            </div>
            <div className="flex gap-3 mt-2 text-[10px] text-gray-500">
              <span>Conflict {s.counts.conflict}</span>
              <span>Disaster {s.counts.disaster}</span>
              <span>Cyber {s.counts.cyber}</span>
              <span className="ml-auto">{s.provenance}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
