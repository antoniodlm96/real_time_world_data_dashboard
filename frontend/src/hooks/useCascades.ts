import { useCallback } from 'react'
import type { CascadeAlert } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useCascades(hours = 24) {
  const fetcher = useCallback(async (): Promise<CascadeAlert[]> => {
    const res = await fetch(`${API_BASE}/cascades?hours=${hours}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.cascades ?? []
  }, [hours])

  const { data, loading, error, refresh } = useSmartPoll<CascadeAlert[]>(fetcher, { intervalMs: 30000 })

  return { cascades: data ?? [], loading, error, refresh }
}
