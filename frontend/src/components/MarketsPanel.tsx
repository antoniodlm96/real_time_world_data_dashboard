import type { CryptoEntry, ForexData } from '../types'

interface MarketsPanelProps {
  crypto: CryptoEntry[]
  forex: ForexData | null
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

export default function MarketsPanel({ crypto, forex }: MarketsPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-3">Cryptocurrencies</h2>
        <div className="space-y-1">
          {crypto.slice(0, 10).map(coin => (
            <div
              key={coin.id}
              className="flex items-center justify-between p-2 bg-gray-800 rounded"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-500 uppercase font-mono w-8 shrink-0">
                  {coin.symbol}
                </span>
                <span className="text-sm text-gray-200 truncate">{coin.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-mono text-gray-100">
                  ${coin.current_price.toLocaleString()}
                </span>
                <PriceChange value={coin.price_change_24h} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {forex && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">
            Forex (base: {forex.base})
          </h2>
          <div className="space-y-1">
            {Object.entries(forex.rates).slice(0, 8).map(([currency, rate]) => (
              <div
                key={currency}
                className="flex items-center justify-between p-2 bg-gray-800 rounded"
              >
                <span className="text-sm text-gray-200 font-mono">{currency}</span>
                <span className="text-sm font-mono text-gray-100">
                  {rate.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
