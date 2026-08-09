import { useState, useCallback, useEffect } from 'react'
import type { RadioStation } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useRadio() {
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  const fetcher = useCallback(async (): Promise<RadioStation[]> => {
    const params = new URLSearchParams({ limit: '200' })
    if (selectedCountry) params.set('country', selectedCountry)
    const res = await fetch(`${API_BASE}/radio?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.stations ?? []
  }, [selectedCountry])

  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/radio/countries`).then(r => r.json())
      setCountries(res.countries ?? [])
    } catch { /* ignore */ }
  }, [])

  const { data, loading, refresh } = useSmartPoll<RadioStation[]>(fetcher, { intervalMs: 60000 })

  useEffect(() => {
    fetchCountries()
  }, [fetchCountries])

  return { stations: data ?? [], loading, countries, selectedCountry, setSelectedCountry, refresh }
}
