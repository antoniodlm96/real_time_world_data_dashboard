import { useState, useEffect, useCallback } from 'react'
import type { Webcam } from '../types'
import { API_BASE } from '../api'

export function useWebcams() {
  const [webcams, setWebcams] = useState<Webcam[]>([])
  const [loading, setLoading] = useState(true)
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  const fetchWebcams = useCallback(async () => {
    try {
      const params = selectedCountry ? `?country=${encodeURIComponent(selectedCountry)}` : ''
      const res = await fetch(`${API_BASE}/webcams${params}`).then(r => r.json())
      setWebcams(res.webcams ?? [])
    } catch {
      // keep old data
    } finally {
      setLoading(false)
    }
  }, [selectedCountry])

  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/webcams/countries`).then(r => r.json())
      setCountries(res.countries ?? [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchWebcams()
    fetchCountries()
    const interval = setInterval(fetchWebcams, 10000)
    return () => clearInterval(interval)
  }, [fetchWebcams, fetchCountries])

  return { webcams, loading, countries, selectedCountry, setSelectedCountry, refresh: fetchWebcams }
}
