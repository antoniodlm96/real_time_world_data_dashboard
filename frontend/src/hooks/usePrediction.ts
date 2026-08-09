import { useCallback } from 'react'
import type { PredictionMarket } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function usePrediction(limit = 30) {
  const fetcher = useCallback(async (): Promise<PredictionMarket[]> => {
    const res = await fetch(`${API_BASE}/prediction/markets?limit=${limit}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.markets ?? []
  }, [limit])

  const { data, loading, error, refresh } = useSmartPoll<PredictionMarket[]>(fetcher, { intervalMs: 120000 })

  return { markets: data ?? [], loading, error, refresh }
}
