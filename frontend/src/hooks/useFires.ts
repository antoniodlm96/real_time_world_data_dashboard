import { useState, useEffect, useCallback, useRef } from 'react'
import type { Fire } from '../types'
import { API_BASE } from '../api'

const POLL_INTERVAL = 60000

export function useFires() {
  const [fires, setFires] = useState<Fire[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchFires = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/fires`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFires(data.fires)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch fires')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFires()
    intervalRef.current = setInterval(fetchFires, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchFires])

  return { fires, loading, error, refresh: fetchFires }
}
