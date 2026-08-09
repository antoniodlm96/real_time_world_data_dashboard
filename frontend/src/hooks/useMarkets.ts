import { useState, useEffect, useCallback, useRef } from 'react'
import type { CryptoEntry, ForexData } from '../types'
import { API_BASE } from '../api'

const REFRESH_INTERVAL = 10000

export function useMarkets() {
  const [crypto, setCrypto] = useState<CryptoEntry[]>([])
  const [forex, setForex] = useState<ForexData | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [cryptoRes, forexRes] = await Promise.all([
        fetch(`${API_BASE}/markets/crypto`).then(r => r.json()),
        fetch(`${API_BASE}/markets/forex`).then(r => r.json()),
      ])
      setCrypto(cryptoRes.crypto ?? [])
      setForex(forexRes.forex ?? null)
    } catch {
      // keep old data on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAll])

  return { crypto, forex, loading, refresh: fetchAll }
}
