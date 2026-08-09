import { useCallback } from 'react'
import type { InfrastructureItem } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useInfrastructure() {
  const fetcher = useCallback(async (): Promise<InfrastructureItem[]> => {
    const res = await fetch(`${API_BASE}/infrastructure`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.items ?? []
  }, [])

  const { data, loading, error, refresh } = useSmartPoll<InfrastructureItem[]>(fetcher, { intervalMs: 300000 })

  return { items: data ?? [], loading, error, refresh }
}
