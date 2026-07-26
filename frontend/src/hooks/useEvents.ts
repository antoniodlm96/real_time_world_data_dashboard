import { useState, useEffect, useCallback, useRef } from 'react'
import type { UnifiedEvent, LayerKey } from '../types'

const REFRESH_INTERVAL = 10000
const API_BASE = '/api'

export function useEvents(hours: number) {
  const [events, setEvents] = useState<Record<LayerKey, UnifiedEvent[]>>({
    disaster: [],
    conflict: [],
    cyber: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    setError(null)
    try {
      const params = `?hours=${hours}`
      const [disasters, conflicts, cyber] = await Promise.all([
        fetch(`${API_BASE}/events/disasters${params}`).then(r => r.json()),
        fetch(`${API_BASE}/events/conflicts${params}`).then(r => r.json()),
        fetch(`${API_BASE}/events/cyber${params}`).then(r => r.json()),
      ])
      setEvents({
        disaster: disasters.events ?? [],
        conflict: conflicts.events ?? [],
        cyber: cyber.events ?? [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAll])

  return { events, loading, error, refresh: fetchAll }
}
