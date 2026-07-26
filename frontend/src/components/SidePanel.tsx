import type { UnifiedEvent, LayerKey } from '../types'

function abbreviateUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url.length > 30 ? url.slice(0, 30) + '…' : url
  }
}

const categoryStyle: Record<LayerKey, { label: string; color: string; shape: string }> = {
  disaster: { label: 'Disasters', color: '#ff2222', shape: 'circle' },
  conflict: { label: 'Conflicts', color: '#00eeff', shape: 'diamond' },
  cyber: { label: 'Cyber Attacks', color: '#ff44ff', shape: 'triangle' },
}

interface SidePanelProps {
  events: Record<LayerKey, UnifiedEvent[]>
  activeLayers: Set<LayerKey>
  onToggleLayer: (layer: LayerKey) => void
}

function ShapeIcon({ color, shape }: { color: string; shape: string }) {
  if (shape === 'diamond') {
    return (
      <span
        className="inline-block shrink-0"
        style={{
          width: 12, height: 12, background: color,
          transform: 'rotate(45deg)',
          border: '2px solid rgba(255,255,255,0.9)',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    )
  }
  if (shape === 'triangle') {
    return (
      <span
        className="inline-block shrink-0"
        style={{
          width: 0, height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderBottom: `12px solid ${color}`,
          filter: `drop-shadow(0 0 3px ${color})`,
        }}
      />
    )
  }
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: 12, height: 12, background: color,
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: `0 0 6px ${color}`,
      }}
    />
  )
}

export default function SidePanel({ events, activeLayers, onToggleLayer }: SidePanelProps) {
  const allCategories: LayerKey[] = ['disaster', 'conflict', 'cyber']

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white mb-4">Events</h2>

      {allCategories.map(cat => {
        const isActive = activeLayers.has(cat)
        const count = events[cat]?.length ?? 0
        return (
          <div key={cat} className="bg-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => onToggleLayer(cat)}
              className={`w-full flex items-center justify-between p-3 transition-colors ${
                isActive ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-750'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShapeIcon color={categoryStyle[cat].color} shape={categoryStyle[cat].shape} />
                <span className="font-medium text-sm">{categoryStyle[cat].label}</span>
              </div>
              <span className="text-xs text-gray-400">{count}</span>
            </button>

            {isActive && (
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-700">
                {count === 0 && (
                  <p className="text-xs text-gray-500 p-3">No events</p>
                )}
                {(events[cat] ?? []).slice(0, 20).map(event => (
                  <div key={event.id} className="p-3 hover:bg-gray-750">
                    <a
                      href={event.source_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-200 leading-tight line-clamp-2 hover:text-blue-400 transition-colors"
                    >
                      {event.title}
                    </a>
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="text-gray-400">{abbreviateUrl(event.source_url || event.source)}</span>
                      {event.magnitude != null && ` · M${event.magnitude}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
