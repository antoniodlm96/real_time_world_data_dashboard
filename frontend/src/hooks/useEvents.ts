import { useCallback } from 'react'
import type { UnifiedEvent, LayerKey } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

const empty: Record<LayerKey, UnifiedEvent[]> = {
  disaster: [],
  conflict: [],
  cyber: [],
  webcam: [],
  radio: [],
  flights: [],
  fires: [],
  weather: [],
  cii: [],
  gpsjam: [],
  infrastructure: [],
  cascades: [],
  prediction: [],
}

export function useEvents(hours: number) {
  const fetcher = useCallback(async (): Promise<Record<LayerKey, UnifiedEvent[]>> => {
    const params = `?hours=${hours}`
    const [disasters, conflicts, cyber] = await Promise.all([
      fetch(`${API_BASE}/events/disasters${params}`).then(r => r.json()),
      fetch(`${API_BASE}/events/conflicts${params}`).then(r => r.json()),
      fetch(`${API_BASE}/events/cyber${params}`).then(r => r.json()),
    ])
    const merged: Record<LayerKey, UnifiedEvent[]> = { ...empty }
    merged.disaster = disasters.events ?? []
    merged.conflict = conflicts.events ?? []
    merged.cyber = cyber.events ?? []
    return merged
  }, [hours])

  const { data, loading, error, refresh } = useSmartPoll<Record<LayerKey, UnifiedEvent[]>>(
    fetcher,
    { intervalMs: 10000 }
  )

  return { events: data ?? empty, loading, error, refresh }
}
