import { useMemo } from 'react'
import type { UnifiedEvent, LayerKey } from '../types'

function formatTickTime(iso: string): string {
  const d = new Date(iso)
  return `UTC ${d.toUTCString().slice(5, -4)}`
}

const categoryColors: Partial<Record<LayerKey, string>> = {
  disaster: 'text-red-400',
  conflict: 'text-cyan-400',
  cyber: 'text-fuchsia-400',
}

const EVENT_CATS: LayerKey[] = ['disaster', 'conflict', 'cyber']

interface TickerProps {
  events: Record<string, UnifiedEvent[]>
}

export default function Ticker({ events }: TickerProps) {
  const headlines = useMemo(() => {
    const items: { title: string; category: LayerKey; timestamp: string }[] = []
    for (const cat of EVENT_CATS) {
      const list = events[cat] || []
      for (const event of list.slice(0, 10)) {
        items.push({ title: event.title, category: cat, timestamp: event.timestamp })
      }
    }
    return items.sort(() => Math.random() - 0.5)
  }, [events])

  if (headlines.length === 0) return null

  return (
    <div className="bg-gray-900 border-b border-gray-700 overflow-hidden h-8">
      <div className="flex items-center h-full">
        <span className="text-xs font-bold uppercase tracking-wider text-white bg-red-600 px-3 py-1 h-full flex items-center shrink-0">
          LIVE
        </span>
        <div className="overflow-hidden flex-1 relative">
          <div className="animate-marquee whitespace-nowrap flex gap-12" style={{ animation: 'marquee 40s linear infinite' }}>
            {headlines.concat(headlines).map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 text-sm">
                <span className="text-gray-500 text-xs">{formatTickTime(item.timestamp)}</span>
                <span className={`text-xs font-bold uppercase ${categoryColors[item.category] || 'text-gray-400'}`}>
                  [{item.category}]
                </span>
                <span className="text-gray-300">{item.title}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
