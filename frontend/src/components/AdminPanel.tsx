import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE } from '../api'

interface Source {
  name: string
  type: string
  url: string
  enabled: boolean
  interval: string
}

interface AIService {
  name: string
  model: string
  task: string
  enabled: boolean
  batch_size: number
  interval: string
  rate_limit: string
}

interface BatchProcess {
  name: string
  interval: number
  last_run: string | null
  remaining_seconds: number
}

interface SourceHealth {
  name: string
  status: string
  last_success?: string
  last_failure?: string
  last_attempt?: string
  age_min?: number
  max_stale_min: number
  source_version: string
  success_count: number
  failure_count: number
}

interface StatusData {
  server_time: string
  sources: Source[]
  ai_services: AIService[]
  database: { path: string; table_counts: Record<string, number> }
  events: { disaster: number; conflict: number; cyber: number; total: number }
  news_classification: { total: number; classified: number; unclassified: number; by_category: Record<string, number> }
  active_counts: { fires: number; flights: number; webcams: number; radio_online: number }
  batch_processes: BatchProcess[]
  source_health: SourceHealth[]
  bluesky: { name: string; type: string; connected: boolean; last_event_time: string | null; last_flush_time: string | null }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 px-2 rounded even:bg-gray-800/50">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs font-mono ${color || 'text-gray-200'}`}>{value}</span>
    </div>
  )
}

const PROCESS_LABELS: Record<string, string> = {
  ingest_all: 'Main Ingestion',
  classify_news: 'News Classification',
  gdacs_rss: 'GDACS RSS',
  check_webcams: 'Webcam Health Check',
  discover_webcams: 'Webcam Discovery',
  discover_radio: 'Radio Discovery',
  cluster_news: 'News Clustering',
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function CountdownBar({ process }: { process: BatchProcess }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = process.last_run
    ? Math.max(0, process.interval - Math.floor((now - new Date(process.last_run).getTime()) / 1000))
    : process.interval
  const pct = process.interval > 0 ? ((process.interval - remaining) / process.interval) * 100 : 0
  const isDue = remaining <= 0 && process.last_run !== null
  const hasRun = process.last_run !== null
  const color = isDue ? 'bg-green-500' : hasRun && remaining < 10 ? 'bg-yellow-500' : 'bg-blue-500'

  return (
    <div className="py-1.5 px-2 rounded even:bg-gray-800/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-300">{PROCESS_LABELS[process.name] || process.name}</span>
        <span className={`text-xs font-mono ${isDue ? 'text-green-400' : 'text-gray-400'}`}>
          {!hasRun ? 'waiting...' : isDue ? 'now' : formatDuration(remaining)}
          {hasRun && <span className="text-gray-600 ml-1">/ {formatDuration(process.interval)}</span>}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  )
}

const LEVEL_COLORS: Record<string, string> = {
  INFO: 'text-gray-400',
  WARNING: 'text-yellow-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-500',
}

interface LogEntry {
  timestamp: string
  level: string
  logger: string
  message: string
}

function LogViewer() {
  const [tab, setTab] = useState<'integration' | 'trace'>('integration')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [newLogs, setNewLogs] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API_BASE}/status/logs?category=${tab}&limit=200`)
        if (!res.ok) return
        const data = await res.json()
        setLogs(data.logs || [])
      } catch { /* ignore */ }
    }
    fetchLogs()
    const id = setInterval(fetchLogs, 2000)
    return () => clearInterval(id)
  }, [tab])

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider shrink-0">Logs</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setTab('integration')}
            className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
              tab === 'integration'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            Integraciones
          </button>
          <button
            onClick={() => setTab('trace')}
            className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
              tab === 'trace'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            Traza
          </button>
        </div>
      </div>
      <div className="bg-gray-950 rounded border border-gray-700 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed p-2">
        {logs.length === 0 && (
          <p className="text-gray-600 italic">No logs</p>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-gray-600 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={`shrink-0 ${LEVEL_COLORS[log.level] || 'text-gray-400'}`}>
              {log.level.padEnd(5)}
            </span>
            <span className="text-gray-600 shrink-0">{log.logger}:</span>
            <span className="text-gray-300 break-all">{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const [data, setData] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [clock, setClock] = useState(Date.now())

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 10000)
    return () => clearInterval(id)
  }, [fetchStatus])

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <p className="text-xs text-gray-500">Loading status...</p>
  if (error) return <p className="text-xs text-red-400">Error: {error}</p>
  if (!data) return null

  const { sources, ai_services, database, events, news_classification, active_counts, batch_processes, bluesky, source_health } = data

  return (
    <div className="flex gap-4 h-full">
      <div className="w-96 shrink-0 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Admin</h2>
          <span className="text-xs text-gray-500 font-mono">
            {new Date(clock).toLocaleTimeString()}
          </span>
        </div>

        <Section title="Batch Processes">
          <div className="space-y-2">
            {batch_processes.map(p => (
              <CountdownBar key={p.name} process={p} />
            ))}
          </div>
        </Section>

        <Section title="Bluesky Firehose">
          <div className="flex items-center gap-2 py-1 px-2 rounded bg-gray-800/50">
            <span className={`w-2 h-2 rounded-full shrink-0 ${bluesky.connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-300">Status:</span>
            <span className={`text-xs font-mono ${bluesky.connected ? 'text-green-400' : 'text-red-400'}`}>
              {bluesky.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </Section>

        <Section title="Source Health">
          <div className="space-y-1">
            {source_health.length === 0 && (
              <p className="text-xs text-gray-500">No sources recorded yet.</p>
            )}
            {source_health.map(s => (
              <div key={s.name} className="py-1 px-2 rounded even:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      s.status === 'ok' ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-xs text-gray-300 truncate">{s.name}</span>
                  </div>
                  <span className={`text-[10px] font-mono ${
                    s.status === 'ok' ? 'text-green-400' : 'text-yellow-400'
                  }`}>{s.status}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 ml-4">
                  {s.age_min != null ? `last success ${s.age_min}min ago` : 'never succeeded'}
                  {' · '}{s.success_count} ok / {s.failure_count} fail
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Data Sources">
          <div className="space-y-1">
            {sources.map(s => (
              <div key={s.name} className="flex items-center justify-between py-1 px-2 rounded even:bg-gray-800/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${s.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-gray-300 truncate">{s.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] text-gray-500">{s.type}</span>
                  <span className="text-[10px] text-gray-600">{s.interval}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="AI Services">
          <div className="space-y-1">
            {ai_services.map(s => (
              <div key={s.name} className="py-1 px-2 rounded even:bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${s.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-gray-300">{s.name}</span>
                  <span className="text-[10px] text-gray-500">{s.model}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 ml-4">{s.task}</p>
                <p className="text-[10px] text-gray-600 mt-0.5 ml-4">Batch: {s.batch_size} · Interval: {s.interval} · {s.rate_limit}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Database">
          <Row label="Path" value={database.path} />
          {Object.entries(database.table_counts).map(([table, count]) => (
            <Row key={table} label={table} value={count.toLocaleString()} />
          ))}
        </Section>

        <Section title="Events">
          <Row label="Disasters" value={events.disaster} color="text-red-400" />
          <Row label="Conflicts" value={events.conflict} color="text-cyan-400" />
          <Row label="Cyber" value={events.cyber} color="text-fuchsia-400" />
          <Row label="Total" value={events.total} color="text-blue-400" />
        </Section>

        <Section title="News Classification">
          <Row label="Total articles" value={news_classification.total} />
          <Row label="Classified" value={news_classification.classified} color="text-green-400" />
          <Row label="Unclassified" value={news_classification.unclassified} color="text-yellow-400" />
          {Object.entries(news_classification.by_category).map(([cat, cnt]) => (
            <Row key={cat} label={`  ${cat}`} value={cnt} />
          ))}
        </Section>

        <Section title="Active Records">
          <Row label="Fires" value={active_counts.fires} color="text-orange-400" />
          <Row label="Flights" value={active_counts.flights} color="text-purple-400" />
          <Row label="Webcams" value={active_counts.webcams} color="text-emerald-400" />
          <Row label="Radio Online" value={active_counts.radio_online} color="text-yellow-400" />
        </Section>
      </div>

      <div className="flex-1 min-w-0">
        <LogViewer />
      </div>
    </div>
  )
}
