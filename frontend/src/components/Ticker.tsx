import { useMemo } from 'react'
import type { UnifiedEvent, LayerKey } from '../types'

const categoryColors: Record<LayerKey, string> = {
  disaster: 'text-red-400',
  conflict: 'text-cyan-400',
  cyber: 'text-fuchsia-400',
}

interface TickerProps {
  events: Record<LayerKey, UnifiedEvent[]>
}

export default function Ticker({ events }: TickerProps) {
  const headlines = useMemo(() => {
    const items: { title: string; category: LayerKey }[] = []
    for (const [cat, list] of Object.entries(events)) {
      for (const event of list.slice(0, 10)) {
        items.push({ title: event.title, category: cat as LayerKey })
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
                <span className={`text-xs font-bold uppercase ${categoryColors[item.category]}`}>
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
