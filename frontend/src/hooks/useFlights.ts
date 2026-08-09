import { useCallback } from 'react'
import type { Flight } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useFlights() {
  const fetcher = useCallback(async (): Promise<Flight[]> => {
    const res = await fetch(`${API_BASE}/flights`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.flights ?? []
  }, [])

  const { data, loading, error, refresh } = useSmartPoll<Flight[]>(fetcher, { intervalMs: 30000 })

  return { flights: data ?? [], loading, error, refresh }
}
