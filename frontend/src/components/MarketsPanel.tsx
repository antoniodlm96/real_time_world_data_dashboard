import { useState } from 'react'
import type { CryptoEntry, ForexData, CommodityEntry, NewsArticle } from '../types'
import MarketChart from './MarketChart'

type Tab = 'crypto' | 'commodities' | 'forex'

interface MarketsPanelProps {
  crypto: CryptoEntry[]
  forex: ForexData | null
  commodities?: CommodityEntry[]
  news?: NewsArticle[]
}

function PriceChange({ value }: { value?: number | null }) {
  if (value == null) return null
  const isPositive = value >= 0
  return (
    <span className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

function chartDataFromCrypto(coin: CryptoEntry): { time: number; close: number }[] {
  const now = Math.floor(Date.now() / 1000)
  const day = 86400
  const points: { time: number; close: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const jitter = (Math.random() - 0.5) * 0.05
    points.push({
      time: now - i * day,
      close: coin.current_price * (1 + jitter * (i / 30)),
    })
  }
  return points
}

const TAB_LABELS: Record<Tab, string> = {
  crypto: 'Crypto',
  commodities: 'Commodities',
  forex: 'Forex',
}

export default function MarketsPanel({ crypto, forex, commodities = [], news = [] }: MarketsPanelProps) {
  const [tab, setTab] = useState<Tab>('crypto')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  const findRelatedNews = (keyword: string): NewsArticle[] => {
    const kw = keyword.toLowerCase()
    return news.filter(n =>
      n.title.toLowerCase().includes(kw) ||
      n.description?.toLowerCase().includes(kw)
    )
  }

  const topCrypto = crypto.slice(0, 6)

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedSymbol(null) }}
            className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'crypto' && (
        <div className="space-y-2">
          {topCrypto.map(coin => {
            const related = findRelatedNews(coin.name)
            return (
              <div key={coin.id} className="bg-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setSelectedSymbol(selectedSymbol === coin.id ? null : coin.id)}
                  className="w-full flex items-center justify-between p-2 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-500 uppercase font-mono w-8 shrink-0">{coin.symbol}</span>
                    <span className="text-sm text-gray-200 truncate">{coin.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-mono text-gray-100">${coin.current_price.toLocaleString()}</span>
                    <PriceChange value={coin.price_change_24h} />
                  </div>
                </button>
                {selectedSymbol === coin.id && (
                  <div className="px-2 pb-2">
                    <MarketChart
                      data={chartDataFromCrypto(coin)}
                      color="#f59e0b"
                      height={180}
                      events={related}
                    />
                    {related.length > 0 && (
                      <div className="text-[10px] text-gray-400 mt-1">Related news events flagged on chart</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'commodities' && (
        <div className="space-y-2">
          {commodities.map(com => {
            const related = findRelatedNews(com.name.split(' ')[0])
            const chartData = com.series.map(s => ({ time: s.time, close: s.close }))
            return (
              <div key={com.symbol} className="bg-gray-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setSelectedSymbol(selectedSymbol === com.symbol ? null : com.symbol)}
                  className="w-full flex items-center justify-between p-2 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-gray-200 truncate">{com.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-mono text-gray-100">${com.current_price.toFixed(2)}</span>
                    <PriceChange value={com.change_pct} />
                  </div>
                </button>
                {selectedSymbol === com.symbol && (
                  <div className="px-2 pb-2">
                    <MarketChart
                      data={chartData}
                      color="#22c55e"
                      height={200}
                      events={related}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {commodities.length === 0 && (
            <p className="text-xs text-gray-500 p-2">Commodities data unavailable</p>
          )}
        </div>
      )}

      {tab === 'forex' && forex && (
        <div className="space-y-1">
          {Object.entries(forex.rates).slice(0, 10).map(([currency, rate]) => (
            <div key={currency} className="flex items-center justify-between p-2 bg-gray-800 rounded">
              <span className="text-sm text-gray-200 font-mono">{currency}</span>
              <span className="text-sm font-mono text-gray-100">{rate.toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
