import { useState, useEffect, useCallback, useRef } from 'react'
import type { CommodityEntry } from '../types'

const POLL_INTERVAL = 60000

export function useCommodities() {
  const [commodities, setCommodities] = useState<CommodityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/markets/commodities')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCommodities(data.commodities ?? [])
    } catch {
      // keep old data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAll])

  return { commodities, loading, refresh: fetchAll }
}
