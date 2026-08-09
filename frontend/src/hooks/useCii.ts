import { useCallback } from 'react'
import type { CiiScore } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useCii(hours = 48) {
  const fetcher = useCallback(async (): Promise<CiiScore[]> => {
    const res = await fetch(`${API_BASE}/cii?hours=${hours}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.scores ?? []
  }, [hours])

  const { data, loading, error, refresh } = useSmartPoll<CiiScore[]>(fetcher, { intervalMs: 60000 })

  return { scores: data ?? [], loading, error, refresh }
}
