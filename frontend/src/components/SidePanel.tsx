import type { UnifiedEvent, LayerKey } from '../types'

function abbreviateUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url.length > 30 ? url.slice(0, 30) + '…' : url
  }
}

const layerDefs: Record<LayerKey, { label: string; color: string; shape: string }> = {
  disaster: { label: 'Disasters', color: '#ff2222', shape: 'circle' },
  conflict: { label: 'Conflicts', color: '#00eeff', shape: 'diamond' },
  cyber: { label: 'Cyber Attacks', color: '#ff44ff', shape: 'triangle' },
  webcam: { label: 'Webcams', color: '#22d3ee', shape: 'webcam' },
  radio: { label: 'Radio', color: '#fbbf24', shape: 'radio' },
  flights: { label: 'Flights', color: '#a78bfa', shape: 'flights' },
  fires: { label: 'Fires', color: '#ff6600', shape: 'fires' },
  weather: { label: 'Weather', color: '#60a5fa', shape: 'weather' },
}

function ShapeIcon({ color, shape }: { color: string; shape: string }) {
  if (shape === 'diamond') {
    return (
      <span className="inline-block shrink-0" style={{
        width: 12, height: 12, background: color,
        transform: 'rotate(45deg)',
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: `0 0 6px ${color}`,
      }} />
    )
  }
  if (shape === 'triangle') {
    return (
      <span className="inline-block shrink-0" style={{
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: `12px solid ${color}`,
        filter: `drop-shadow(0 0 3px ${color})`,
      }} />
    )
  }
  if (shape === 'webcam') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill={color} className="shrink-0">
        <path d="M12 2C9.2 2 7 4.2 7 7c0 3.5 5 10 5 10s5-6.5 5-10c0-2.8-2.2-5-5-5zm0 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
      </svg>
    )
  }
  if (shape === 'radio') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill={color} className="shrink-0">
        <path d="M3.24 6.15C2.46 5.64 2 4.86 2 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M3 2v20M21 2v20M8 6.15C7.46 5.64 7 4.86 7 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M8 2v20M15 2v20M14 6.15C13.46 5.64 13 4.86 13 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M15 21c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z"/>
      </svg>
    )
  }
  if (shape === 'flights') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill={color} className="shrink-0">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    )
  }
  if (shape === 'fires') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill={color} className="shrink-0">
        <path d="M12 2C9.5 5.5 6 9 6 13c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-3.5-7.5-6-11z"/>
      </svg>
    )
  }
  if (shape === 'weather') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill={color} className="shrink-0">
        <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/>
      </svg>
    )
  }
  return (
    <span className="inline-block rounded-full shrink-0" style={{
      width: 12, height: 12, background: color,
      border: '2px solid rgba(255,255,255,0.9)',
      boxShadow: `0 0 6px ${color}`,
    }} />
  )
}

interface SidePanelProps {
  events: Record<LayerKey, UnifiedEvent[]>
  activeLayers: Set<LayerKey>
  onToggleLayer: (layer: LayerKey) => void
  extraLayers?: Record<string, number>
}

export default function SidePanel({ events, activeLayers, onToggleLayer, extraLayers = {} }: SidePanelProps) {
  const eventCats: LayerKey[] = ['disaster', 'conflict', 'cyber']
  const mapLayers: LayerKey[] = ['webcam', 'radio', 'flights', 'fires', 'weather']

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white mb-2">Events</h2>

      {eventCats.map(cat => {
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
                <ShapeIcon color={layerDefs[cat].color} shape={layerDefs[cat].shape} />
                <span className="font-medium text-sm">{layerDefs[cat].label}</span>
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

      <h2 className="text-lg font-bold text-white mb-2 mt-4">Map Layers</h2>

      {mapLayers.map(layer => {
        const isActive = activeLayers.has(layer)
        const count = extraLayers[layer] ?? 0
        return (
          <button
            key={layer}
            onClick={() => onToggleLayer(layer)}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
              isActive ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-750'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShapeIcon color={layerDefs[layer].color} shape={layerDefs[layer].shape} />
              <span className="text-sm font-medium">{layerDefs[layer].label}</span>
            </div>
            <span className="text-xs text-gray-400">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
