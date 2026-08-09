import { useState, useEffect, useCallback, useRef } from 'react'
import type { WeatherEntry } from '../types'
import { API_BASE } from '../api'

const POLL_INTERVAL = 300000

export function useWeather() {
  const [weather, setWeather] = useState<WeatherEntry[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/weather`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setWeather(data.weather ?? [])
    } catch {
      // keep old data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWeather()
    intervalRef.current = setInterval(fetchWeather, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchWeather])

  return { weather, loading, refresh: fetchWeather }
}
