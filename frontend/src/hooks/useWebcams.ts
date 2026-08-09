import { useState, useCallback, useEffect } from 'react'
import type { Webcam } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useWebcams() {
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  const fetcher = useCallback(async (): Promise<Webcam[]> => {
    const params = selectedCountry ? `?country=${encodeURIComponent(selectedCountry)}` : ''
    const res = await fetch(`${API_BASE}/webcams${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.webcams ?? []
  }, [selectedCountry])

  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/webcams/countries`).then(r => r.json())
      setCountries(res.countries ?? [])
    } catch {
      // ignore
    }
  }, [])

  const { data, loading, refresh } = useSmartPoll<Webcam[]>(fetcher, { intervalMs: 10000 })

  useEffect(() => {
    fetchCountries()
  }, [fetchCountries])

  return { webcams: data ?? [], loading, countries, selectedCountry, setSelectedCountry, refresh }
}
