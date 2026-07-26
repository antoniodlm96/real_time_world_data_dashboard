import { useState, useEffect, useCallback } from 'react'
import type { NewsArticle } from '../types'

const API_BASE = '/api'

export function useNews(hours: number) {
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  const fetchNews = useCallback(async () => {
    try {
      const params = new URLSearchParams({ hours: String(hours) })
      if (selectedCountry) params.set('country', selectedCountry)
      const res = await fetch(`${API_BASE}/news?${params}`).then(r => r.json())
      setNews(res.news ?? [])
    } catch {
      // keep old
    } finally {
      setLoading(false)
    }
  }, [selectedCountry, hours])

  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/news/countries`).then(r => r.json())
      setCountries(res.countries ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchNews()
    fetchCountries()
    const interval = setInterval(fetchNews, 30000)
    return () => clearInterval(interval)
  }, [fetchNews, fetchCountries])

  return { news, loading, countries, selectedCountry, setSelectedCountry, refresh: fetchNews }
}
