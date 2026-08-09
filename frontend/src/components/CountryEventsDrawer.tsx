import type { CountryGroup } from '../utils/groupEvents'

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  disaster: { label: 'Disaster', color: '#ff2222' },
  conflict: { label: 'Conflict', color: '#00eeff' },
  cyber: { label: 'Cyber', color: '#ff44ff' },
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export default function CountryEventsDrawer({ group, onClose }: { group: CountryGroup | null; onClose: () => void }) {
  if (!group) return null
  return (
    <div className="absolute inset-0 z-[1000] flex justify-end pointer-events-none">
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={onClose} />
      <div className="relative w-96 max-w-[85vw] h-full bg-gray-900 border-l border-gray-700 shadow-2xl pointer-events-auto drawer-slide-in overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/60">
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">{group.country}</h3>
            <p className="text-xs text-gray-400">{group.total} events</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-56px)] divide-y divide-gray-800">
          {group.categories.map(({ category, count }) => {
            const meta = CATEGORY_META[category] || { label: category, color: '#888' }
            const events = group.events.filter(e => e.category === category)
            return (
              <div key={category}>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/40 sticky top-0 backdrop-blur">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                    {meta.label}
                  </span>
                  <span className="ml-auto text-xs text-gray-500">{count}</span>
                </div>
                {events.map(ev => (
                  <div key={ev.id} className="px-4 py-3 hover:bg-gray-800/60 transition-colors">
                    <a
                      href={ev.source_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-200 leading-snug line-clamp-2 hover:text-blue-400 transition-colors"
                    >
                      {ev.title}
                    </a>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                      <span className="text-gray-400">{ev.source}</span>
                      {ev.magnitude != null && <span>· M{ev.magnitude}</span>}
                      <span className="ml-auto text-gray-600">{formatTime(ev.timestamp)}</span>
                    </div>
                    {ev.location?.place && (
                      <span className="inline-block text-[11px] text-gray-600 mt-0.5">
                        {ev.location.place}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
