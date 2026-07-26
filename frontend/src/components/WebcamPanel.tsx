import { useState } from 'react'
import type { Webcam } from '../types'

interface WebcamPanelProps {
  webcams: Webcam[]
  countries: string[]
  selectedCountry: string | null
  onSelectCountry: (country: string | null) => void
}

export default function WebcamPanel({
  webcams,
  countries,
  selectedCountry,
  onSelectCountry,
}: WebcamPanelProps) {
  const [filter, setFilter] = useState('')

  const filtered = filter
    ? webcams.filter(
        w =>
          w.title.toLowerCase().includes(filter.toLowerCase()) ||
          w.city?.toLowerCase().includes(filter.toLowerCase()) ||
          w.country?.toLowerCase().includes(filter.toLowerCase())
      )
    : webcams

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-white">Live Webcams</h2>
        <span className="text-xs text-gray-500">({webcams.length})</span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search city or country..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 bg-gray-800 text-sm text-gray-200 px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
        <button
          onClick={() => onSelectCountry(null)}
          className={`text-xs px-2 py-1 rounded ${
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
            onClick={() => onSelectCountry(c)}
            className={`text-xs px-2 py-1 rounded ${
              selectedCountry === c
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1">
        {filtered.map(w => (
          <WebcamCard key={w.id} webcam={w} />
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">No webcams found</p>
        )}
      </div>
    </div>
  )
}

function WebcamCard({ webcam }: { webcam: Webcam }) {
  const [open, setOpen] = useState(false)

  const location = [webcam.city, webcam.province, webcam.country]
    .filter(Boolean)
    .join(', ')

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors"
      >
        {webcam.thumbnail_url && (
          <img
            src={webcam.thumbnail_url}
            alt=""
            className="w-full h-24 object-cover"
            loading="lazy"
          />
        )}
        <div className="p-2">
          <p className="text-sm text-gray-200 leading-tight">{webcam.title}</p>
          {location && (
            <p className="text-xs text-gray-500 mt-1">{location}</p>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="relative" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${extractYoutubeId(webcam.url)}?autoplay=1&mute=1`}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
      <div className="p-2 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm text-gray-200 truncate">{webcam.title}</p>
          {location && (
            <p className="text-xs text-gray-500">{location}</p>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-white shrink-0 ml-2"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function extractYoutubeId(url: string): string {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  return m ? m[1] : ''
}
