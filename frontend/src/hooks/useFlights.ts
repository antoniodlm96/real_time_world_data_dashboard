import { useState, useEffect, useCallback, useRef } from 'react'
import type { Flight } from '../types'

const POLL_INTERVAL = 30000

export function useFlights() {
  const [flights, setFlights] = useState<Flight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchFlights = useCallback(async () => {
    try {
      const res = await fetch('/api/flights')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setFlights(data.flights)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch flights')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlights()
    intervalRef.current = setInterval(fetchFlights, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchFlights])

  return { flights, loading, error, refresh: fetchFlights }
}
