import { useCallback } from 'react'
import type { Fire } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useFires() {
  const fetcher = useCallback(async (): Promise<Fire[]> => {
    const res = await fetch(`${API_BASE}/fires`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.fires ?? []
  }, [])

  const { data, loading, error, refresh } = useSmartPoll<Fire[]>(fetcher, { intervalMs: 60000 })

  return { fires: data ?? [], loading, error, refresh }
}
