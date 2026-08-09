import { useState, useEffect, useCallback } from 'react'
import type { RadioStation } from '../types'
import { API_BASE } from '../api'

export function useRadio() {
  const [stations, setStations] = useState<RadioStation[]>([])
  const [loading, setLoading] = useState(true)
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  const fetchStations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (selectedCountry) params.set('country', selectedCountry)
      const res = await fetch(`${API_BASE}/radio?${params}`).then(r => r.json())
      setStations(res.stations ?? [])
    } catch {
      // keep old
    } finally {
      setLoading(false)
    }
  }, [selectedCountry])

  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/radio/countries`).then(r => r.json())
      setCountries(res.countries ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchStations()
    fetchCountries()
    const interval = setInterval(fetchStations, 60000)
    return () => clearInterval(interval)
  }, [fetchStations, fetchCountries])

  return { stations, loading, countries, selectedCountry, setSelectedCountry, refresh: fetchStations }
}
