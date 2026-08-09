import { useCallback } from 'react'
import type { CryptoEntry, ForexData } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

interface MarketData {
  crypto: CryptoEntry[]
  forex: ForexData | null
}

export function useMarkets() {
  const fetcher = useCallback(async (): Promise<MarketData> => {
    const [cryptoRes, forexRes] = await Promise.all([
      fetch(`${API_BASE}/markets/crypto`).then(r => r.json()),
      fetch(`${API_BASE}/markets/forex`).then(r => r.json()),
    ])
    return {
      crypto: cryptoRes.crypto ?? [],
      forex: forexRes.forex ?? null,
    }
  }, [])

  const { data, loading, refresh } = useSmartPoll<MarketData>(fetcher, { intervalMs: 10000 })

  return {
    crypto: data?.crypto ?? [],
    forex: data?.forex ?? null,
    loading,
    refresh,
  }
}
