import { useState } from 'react'
import type { RadioStation } from '../types'

interface RadioPanelProps {
  stations: RadioStation[]
  countries: string[]
  selectedCountry: string | null
  onSelectCountry: (country: string | null) => void
}

const ITEMS_PER_PAGE = 30

export default function RadioPanel({ stations, countries, selectedCountry, onSelectCountry }: RadioPanelProps) {
  const [page, setPage] = useState(0)
  const [playing, setPlaying] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = search
    ? stations.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.tags || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.language || '').toLowerCase().includes(search.toLowerCase())
      )
    : stations

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const pageItems = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)

  const handlePlay = (id: string, streamUrl: string) => {
    if (playing === id) {
      setPlaying(null)
    } else {
      setPlaying(id)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-white">Radio</h2>
        <span className="text-xs text-gray-500">({stations.length})</span>
      </div>

      <input
        type="text"
        placeholder="Search stations..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0) }}
        className="w-full bg-gray-800 text-gray-200 text-xs px-3 py-1.5 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
      />

      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
        <button
          onClick={() => { onSelectCountry(null); setPage(0) }}
          className={`text-xs px-2 py-1 rounded shrink-0 ${
            selectedCountry === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {countries.map(c => (
          <button
            key={c}
            onClick={() => { onSelectCountry(c); setPage(0) }}
            className={`text-xs px-2 py-1 rounded shrink-0 ${
              selectedCountry === c
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
        {pageItems.map(s => (
          <div
            key={s.id}
            className="bg-gray-800 rounded-lg p-2.5 hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-start gap-2">
              {s.favicon && (
                <img
                  src={s.favicon}
                  alt=""
                  className="w-8 h-8 rounded object-cover mt-0.5"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm text-gray-200 font-medium truncate">{s.name}</p>
                  {s.frequency && (
                    <span className="text-[10px] font-mono text-yellow-500 bg-yellow-900/30 px-1 py-0.5 rounded">{s.frequency}</span>
                  )}
                  {s.codec && (
                    <span className="text-[10px] text-gray-600 uppercase">{s.codec}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {s.country}{s.state ? ` · ${s.state}` : ''}
                  {s.language ? ` · ${s.language}` : ''}
                  {s.tags ? ` · ${s.tags.split(',')[0]}` : ''}
                </p>
                {s.description && (
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{s.description}</p>
                )}
              </div>
              {s.stream_url && (
                <button
                  onClick={() => handlePlay(s.id, s.stream_url)}
                  className={`text-xs px-2 py-1 rounded shrink-0 ${
                    playing === s.id
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="Play stream"
                >
                  {playing === s.id ? 'Stop' : 'Play'}
                </button>
              )}
            </div>
            {playing === s.id && (
              <audio
                src={s.stream_url}
                autoPlay
                controls
                className="w-full mt-2 h-8"
                onEnded={() => setPlaying(null)}
              />
            )}
          </div>
        ))}
        {pageItems.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">No radio stations</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500 py-1">{page + 1}/{totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
