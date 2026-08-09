import { useEffect, useRef, useState } from 'react'

const BACKOFF_BASE_MS = 5000
const BACKOFF_MAX_MS = 60000
const BACKOFF_FACTOR = 2

export interface SmartPollOptions {
  intervalMs: number
  enabled?: boolean
  onVisible?: () => void
}

interface PollState {
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useSmartPoll<T>(
  fetcher: () => Promise<T>,
  { intervalMs, enabled = true }: SmartPollOptions
): PollState & { data: T | null } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetcherRef = useRef(fetcher)
  const enabledRef = useRef(enabled)
  const dataRef = useRef<T | null>(null)
  const intervalRef = useRef<number | null>(null)
  const backoffRef = useRef(BACKOFF_BASE_MS)
  const visibleRef = useRef(!document.hidden)
  const mountedRef = useRef(true)

  fetcherRef.current = fetcher
  enabledRef.current = enabled

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      window.clearTimeout(intervalRef.current)
      intervalRef.current = null
    }
  }

  const schedule = () => {
    clearTimer()
    if (!mountedRef.current || !enabledRef.current) return
    intervalRef.current = window.setTimeout(run, intervalMs)
  }

  const run = async () => {
    if (!mountedRef.current || !enabledRef.current) return
    if (dataRef.current === null) setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      if (!mountedRef.current) return
      dataRef.current = result
      setData(result)
      backoffRef.current = BACKOFF_BASE_MS
    } catch (e) {
      if (!mountedRef.current) return
      setError(e instanceof Error ? e.message : 'Failed to fetch')
      backoffRef.current = Math.min(backoffRef.current * BACKOFF_FACTOR, BACKOFF_MAX_MS)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        schedule()
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true
    visibleRef.current = !document.hidden
    run()

    const onVisibility = () => {
      const wasVisible = visibleRef.current
      visibleRef.current = !document.hidden
      if (!wasVisible && visibleRef.current) {
        backoffRef.current = BACKOFF_BASE_MS
        schedule()
      } else if (!visibleRef.current) {
        clearTimer()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimer()
    }
  }, [])

  return { data, loading, error, refresh: run }
}
