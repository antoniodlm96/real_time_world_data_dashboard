import { useState } from 'react'
import type { PredictionMarket } from '../types'

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

interface PredictionPanelProps {
  markets: PredictionMarket[]
}

export default function PredictionPanel({ markets }: PredictionPanelProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const top = markets.slice(0, 20)

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold text-white mb-2">Prediction Markets</h2>
      <p className="text-[11px] text-gray-500">Top Polymarket contracts by 24h volume. Prices are implied probabilities.</p>
      {top.length === 0 && <p className="text-xs text-gray-500">No markets available.</p>}
      {top.map(m => {
        const lead = m.outcomes.find(o => o.price != null)
        const price = lead?.price ?? null
        const expanded = selected === m.id
        return (
          <div key={m.id} className="bg-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setSelected(expanded ? null : m.id)}
              className="w-full flex items-start justify-between gap-2 p-3 hover:bg-gray-750 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm text-gray-200 leading-tight line-clamp-2">{m.question}</p>
                <p className="text-[10px] text-gray-500 mt-1">24h vol: {formatVolume(m.volume24hr)}</p>
              </div>
              {price != null && (
                <span className="text-sm font-mono text-gray-100 shrink-0">{price.toFixed(1)}%</span>
              )}
            </button>
            {expanded && (
              <div className="px-3 pb-3 space-y-1.5">
                {m.outcomes.map(o => (
                  <div key={o.name} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{o.name}</span>
                    <span className="text-gray-200 font-mono">{o.price != null ? `${o.price.toFixed(1)}%` : '—'}</span>
                  </div>
                ))}
                {m.end_date && (
                  <p className="text-[10px] text-gray-500">Resolves: {new Date(m.end_date).toUTCString().slice(5, -4)}</p>
                )}
                {m.url && (
                  <a href={m.url} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 text-[10px] block mt-1 hover:underline">View on Polymarket ↗</a>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
