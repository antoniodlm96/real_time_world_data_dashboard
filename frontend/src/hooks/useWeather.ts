import { useCallback } from 'react'
import type { WeatherEntry } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useWeather() {
  const fetcher = useCallback(async (): Promise<WeatherEntry[]> => {
    const res = await fetch(`${API_BASE}/weather`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.weather ?? []
  }, [])

  const { data, loading, error, refresh } = useSmartPoll<WeatherEntry[]>(fetcher, { intervalMs: 300000 })

  return { weather: data ?? [], loading, error, refresh }
}
