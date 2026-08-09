import { useMemo } from 'react'
import type { NewsArticle } from '../types'

interface NewsPanelProps {
  news: NewsArticle[]
  countries: string[]
  selectedCountry: string | null
  onSelectCountry: (country: string | null) => void
}

function formatTimeBoth(iso: string): string {
  const d = new Date(iso)
  return `UTC: ${d.toUTCString().slice(5, -4)}  |  Local: ${d.toLocaleString()}`
}

export default function NewsPanel({ news, countries, selectedCountry, onSelectCountry }: NewsPanelProps) {
  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of news) {
      if (a.cluster_id) counts[a.cluster_id] = (counts[a.cluster_id] ?? 0) + 1
    }
    return counts
  }, [news])
  const clustered = news.filter(a => a.cluster_id).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-white">News</h2>
        <span className="text-xs text-gray-500">({news.length})</span>
        {clustered > 0 && (
          <span className="text-[10px] text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">
            {clustered} deduplicated
          </span>
        )}
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

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {news.slice(0, 50).map(a => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors"
          >
            {a.image_url && (
              <img
                src={a.image_url}
                alt=""
                className="w-full h-24 object-cover rounded mb-2"
                loading="lazy"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="flex items-start gap-2">
              {a.category && (
                <span className={`text-[10px] uppercase font-bold px-1 py-0.5 rounded shrink-0 mt-0.5 ${
                  a.category === 'disaster' ? 'text-red-400 bg-red-900/30' :
                  a.category === 'conflict' ? 'text-orange-400 bg-orange-900/30' :
                  a.category === 'cyber' ? 'text-purple-400 bg-purple-900/30' :
                  a.category === 'politics' ? 'text-blue-400 bg-blue-900/30' :
                  'text-gray-500 bg-gray-800'
                }`}>
                  {a.category}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 leading-tight line-clamp-2">{a.translated_title || a.title}</p>
                {a.translated_title && a.translated_title !== a.title && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 italic">{a.title}</p>
                )}
              </div>
            </div>
            {a.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.description}</p>
            )}
            <p className="text-xs text-gray-600 mt-2">
              <span className="text-gray-400">{a.source_name}</span>
              {a.source_country && <span className="text-gray-600"> · {a.source_country}</span>}
              <span className="text-gray-600"> · {formatTimeBoth(a.published_at)}</span>
              {a.cluster_id && clusterCounts[a.cluster_id] > 1 && (
                <span className="ml-2 text-[10px] text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">
                  {clusterCounts[a.cluster_id]} similar
                </span>
              )}
            </p>
          </a>
        ))}
        {news.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">No news articles</p>
        )}
      </div>
    </div>
  )
}
