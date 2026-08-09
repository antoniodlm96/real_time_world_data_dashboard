import { useCallback } from 'react'
import type { CommodityEntry } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useCommodities() {
  const fetcher = useCallback(async (): Promise<CommodityEntry[]> => {
    const res = await fetch(`${API_BASE}/markets/commodities`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.commodities ?? []
  }, [])

  const { data, loading, refresh } = useSmartPoll<CommodityEntry[]>(fetcher, { intervalMs: 60000 })

  return { commodities: data ?? [], loading, refresh }
}
