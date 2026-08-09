import { useState, useCallback, useEffect } from 'react'
import type { NewsArticle } from '../types'
import { API_BASE } from '../api'
import { useSmartPoll } from './useSmartPoll'

export function useNews(hours: number) {
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  const fetcher = useCallback(async (): Promise<NewsArticle[]> => {
    const params = new URLSearchParams({ hours: String(hours) })
    if (selectedCountry) params.set('country', selectedCountry)
    const res = await fetch(`${API_BASE}/news?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.news ?? []
  }, [selectedCountry, hours])

  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/news/countries`).then(r => r.json())
      setCountries(res.countries ?? [])
    } catch { /* ignore */ }
  }, [])

  const { data, loading, refresh } = useSmartPoll<NewsArticle[]>(fetcher, { intervalMs: 30000 })

  useEffect(() => {
    fetchCountries()
  }, [fetchCountries])

  return { news: data ?? [], loading, countries, selectedCountry, setSelectedCountry, refresh }
}
