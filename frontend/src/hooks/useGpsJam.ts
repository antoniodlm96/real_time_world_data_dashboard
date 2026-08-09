import { useCallback } from 'react'
import type { GpsJamHex } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useGpsJam() {
  const fetcher = useCallback(async (): Promise<GpsJamHex[]> => {
    const res = await fetch(`${API_BASE}/gpsjam`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.hexes ?? []
  }, [])

  const { data, loading, error, refresh } = useSmartPoll<GpsJamHex[]>(fetcher, { intervalMs: 600000 })

  return { hexes: data ?? [], loading, error, refresh }
}
