import { useEffect, useRef } from 'react'
import Globe from 'globe.gl'
import type { GlobeInstance } from 'globe.gl'
import type {
  UnifiedEvent,
  LayerKey,
  Webcam,
  RadioStation,
  Flight,
  Fire,
  WeatherEntry,
  GpsJamHex,
  InfrastructureItem,
  CascadeAlert,
  CiiScore,
} from '../types'
import { groupEventsByCountry, categoryOffset, type CountryGroup } from '../utils/groupEvents'

const TEXTURE = `${import.meta.env.BASE_URL}textures/earth-topo-bathy.jpg`
const BG_TEXTURE = `${import.meta.env.BASE_URL}textures/night-sky.png`

const CATEGORY_COLORS: Record<string, string> = {
  disaster: '#ff2222',
  conflict: '#00eeff',
  cyber: '#ff44ff',
}

const GPSJAM_COLORS: Record<string, string> = {
  high: '#ff2222',
  medium: '#ffb300',
}

const CII_COLORS: Record<string, string> = {
  critical: '#ff2222',
  high: '#ff8a00',
  medium: '#ffd700',
  low: '#22c55e',
}

interface GlobeMarker {
  _kind: string
  _lat: number
  _lng: number
  color: string
  label: string
  detail?: string
  icon?: string
  size?: number
  count?: number
  _onClick?: () => void
}

function buildMarkerElement(m: GlobeMarker): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;'
  const size = m.size ?? 14
  wrap.style.width = `${size}px`
  wrap.style.height = `${size}px`

  const dot = document.createElement('div')
  if (m.icon) {
    dot.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${m.color}" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"><path d="${m.icon}"/></svg>`
  } else {
    dot.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${m.color};`
    if (m._kind === 'conflict' || m._kind === 'disaster' || m._kind === 'cyber' || m._kind === 'group') {
      dot.style.border = '2px solid rgba(255,255,255,0.85)'
      dot.style.boxShadow = `0 0 ${Math.min(18, size)}px ${m.color}`
    }
  }
  dot.style.filter = 'drop-shadow(0 0 3px rgba(0,0,0,0.7))'
  wrap.appendChild(dot)

  if (m.count != null) {
    const badge = document.createElement('div')
    badge.textContent = String(m.count)
    badge.style.cssText =
      'position:absolute;top:-6px;right:-8px;min-width:16px;height:16px;border-radius:8px;' +
      'background:#111;border:1px solid rgba(255,255,255,0.9);color:#fff;' +
      'font:700 10px/15px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'text-align:center;padding:0 3px;box-shadow:0 0 6px rgba(0,0,0,0.7);z-index:11;'
    wrap.appendChild(badge)
  }

  const tip = document.createElement('div')
  tip.textContent = m.label
  tip.style.cssText =
    'position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;' +
    'background:rgba(10,10,10,0.92);color:#e8e8e8;border:1px solid #2a2a2a;border-radius:4px;' +
    'padding:3px 7px;font:11px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'pointer-events:none;opacity:0;transition:opacity .15s;z-index:10;'
  wrap.appendChild(tip)

  wrap.addEventListener('mouseenter', () => { tip.style.opacity = '1' })
  wrap.addEventListener('mouseleave', () => { tip.style.opacity = '0' })
  if (m._onClick) {
    wrap.addEventListener('click', e => {
      e.stopPropagation()
      m._onClick?.()
    })
  }
  return wrap
}

interface GlobeMapProps {
  events: UnifiedEvent[]
  activeLayers: Set<LayerKey>
  webcams?: Webcam[]
  radioStations?: RadioStation[]
  flights?: Flight[]
  fires?: Fire[]
  weather?: WeatherEntry[]
  cii?: CiiScore[]
  gpsjam?: GpsJamHex[]
  infrastructure?: InfrastructureItem[]
  cascades?: CascadeAlert[]
  onSelectGroup?: (g: CountryGroup) => void
}

const INFRA_ICONS: Record<string, string> = {
  port: 'M11 9h4v6h-4V9zm-6 0h4v6H5V9zm12 0h4v6h-4V9z',
  military: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4zm0 2.5L6 7.5v4.5c0 3.8 2.5 6.3 6 8 3.5-1.7 6-4.2 6-8V7.5l-6-3z',
  pipeline: 'M12 3v18M8 3v18M4 3v18M16 3v18M20 3v18',
  cable: 'M12 2a7 7 0 0 0-7 7v6a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7zm0 2a5 5 0 0 1 5 5v6a5 5 0 0 1-10 0V9a5 5 0 0 1 5-5z',
  chokepoint: 'M4 5h16v14H4zM6 7v10h12V7H6zm3 2h6v2H9V9zm0 4h6v2H9v-2z',
}

const WEBCAM_ICON = 'M12 2C9.2 2 7 4.2 7 7c0 3.5 5 10 5 10s5-6.5 5-10c0-2.8-2.2-5-5-5zm0 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z'
const RADIO_ICON = 'M3.24 6.15C2.46 5.64 2 4.86 2 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M3 2v20M21 2v20M8 6.15C7.46 5.64 7 4.86 7 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M8 2v20M15 2v20M14 6.15C13.46 5.64 13 4.86 13 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M15 21c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z'
const FLIGHT_ICON = 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z'
const FIRE_ICON = 'M12 2C9.5 5.5 6 9 6 13c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-3.5-7.5-6-11z'
const CASCADE_ICON = 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z'
const WEATHER_ICON = 'M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z'

export default function GlobeMap({
  events,
  activeLayers,
  webcams = [],
  radioStations = [],
  flights = [],
  fires = [],
  weather = [],
  cii = [],
  gpsjam = [],
  infrastructure = [],
  cascades = [],
  onSelectGroup,
}: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeInstance | null>(null)
  const layersRef = useRef(activeLayers)
  layersRef.current = activeLayers

  useEffect(() => {
    if (!containerRef.current || globeRef.current) return

    const globe = new Globe(containerRef.current, { animateIn: true })
    globeRef.current = globe

    globe
      .globeImageUrl(TEXTURE)
      .backgroundImageUrl(BG_TEXTURE)
      .atmosphereColor('#4466cc')
      .atmosphereAltitude(0.18)
      .backgroundColor('rgba(0,0,0,0)')
      .showGraticules(false)

    const controls = globe.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.3
    controls.enablePan = false
    controls.enableZoom = true
    controls.zoomSpeed = 1.4
    controls.minDistance = 101
    controls.maxDistance = 600

    let autoRotateTimer: ReturnType<typeof setTimeout> | null = null
    const pauseAutoRotate = () => {
      controls.autoRotate = false
      if (autoRotateTimer) clearTimeout(autoRotateTimer)
    }
    const scheduleResume = () => {
      if (autoRotateTimer) clearTimeout(autoRotateTimer)
      autoRotateTimer = setTimeout(() => { controls.autoRotate = true }, 60_000)
    }
    const canvas = containerRef.current.querySelector('canvas')
    if (canvas) {
      canvas.addEventListener('mousedown', pauseAutoRotate)
      canvas.addEventListener('touchstart', pauseAutoRotate, { passive: true })
      canvas.addEventListener('mouseup', scheduleResume)
      canvas.addEventListener('touchend', scheduleResume)
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100% !important;height:100% !important;'
    }

    globe.htmlElementsData([])
    globe.htmlLat((d: object) => (d as GlobeMarker)._lat)
    globe.htmlLng((d: object) => (d as GlobeMarker)._lng)
    globe.htmlAltitude((d: object) => {
      const m = d as GlobeMarker
      if (m._kind === 'flight' || m._kind === 'cascade') return 0.012
      if (m._kind === 'cii') return 0.006
      return 0.003
    })
    globe.htmlElement((d: object) => buildMarkerElement(d as GlobeMarker))

    const onResize = () => {
      const w = containerRef.current?.clientWidth || window.innerWidth
      const h = containerRef.current?.clientHeight || window.innerHeight
      globe.width(w)
      globe.height(h)
    }
    onResize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      globe._destructor()
      globeRef.current = null
    }
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const markers: GlobeMarker[] = []
    const layers = layersRef.current

    if (layers.has('disaster') || layers.has('conflict') || layers.has('cyber')) {
      const { groups, singles } = groupEventsByCountry(events)
      for (const g of groups) {
        g.categories.forEach(({ category, count }, idx) => {
          if (!layers.has(category as LayerKey)) return
          const [latOff, lngOff] = categoryOffset(idx)
          markers.push({
            _kind: 'group',
            _lat: g.lat + latOff,
            _lng: g.lng + lngOff,
            color: CATEGORY_COLORS[category] || '#6b7280',
            label: `${g.country} · ${count} ${category}`,
            size: 14,
            count,
            _onClick: () => onSelectGroup?.(g),
          })
        })
      }
      for (const e of singles) {
        if (!e.location) continue
        if (!layers.has(e.category as LayerKey)) continue
        markers.push({
          _kind: e.category,
          _lat: e.location.lat,
          _lng: e.location.lng,
          color: CATEGORY_COLORS[e.category] || '#6b7280',
          label: e.title,
          size: e.category === 'disaster' && e.magnitude != null
            ? Math.max(10, 8 + e.magnitude * 2)
            : 14,
        })
      }
    }
    if (layers.has('webcam')) {
      for (const w of webcams) {
        if (!w.lat || !w.lng) continue
        markers.push({ _kind: 'webcam', _lat: w.lat, _lng: w.lng, color: '#22d3ee', label: w.title, icon: WEBCAM_ICON })
      }
    }
    if (layers.has('radio')) {
      for (const s of radioStations) {
        if (!s.geo_lat || !s.geo_lng) continue
        markers.push({ _kind: 'radio', _lat: s.geo_lat, _lng: s.geo_lng, color: '#fbbf24', label: s.name, icon: RADIO_ICON })
      }
    }
    if (layers.has('flights')) {
      for (const f of flights) {
        markers.push({ _kind: 'flight', _lat: f.lat, _lng: f.lng, color: '#a78bfa', label: `${f.callsign || 'Flight'} · ${f.altitude.toLocaleString()}ft`, icon: FLIGHT_ICON, size: 12 })
      }
    }
    if (layers.has('fires')) {
      for (const f of fires) {
        if (!f.lat || !f.lng) continue
        markers.push({ _kind: 'fire', _lat: f.lat, _lng: f.lng, color: '#ff6600', label: `Fire · ${f.satellite}`, icon: FIRE_ICON, size: 12 })
      }
    }
    if (layers.has('weather')) {
      for (const w of weather) {
        markers.push({ _kind: 'weather', _lat: w.lat, _lng: w.lng, color: '#60a5fa', label: `${w.city}, ${w.country} · ${w.temperature}°C`, icon: WEATHER_ICON, size: 12 })
      }
    }
    if (layers.has('cii')) {
      for (const s of cii) {
        if (s.lat == null || s.lng == null) continue
        markers.push({ _kind: 'cii', _lat: s.lat, _lng: s.lng, color: CII_COLORS[s.severity] || '#888', label: `${s.country} · CII ${s.score.toFixed(1)}`, size: Math.max(8, 6 + s.score / 12) })
      }
    }
    if (layers.has('gpsjam')) {
      for (const h of gpsjam) {
        if (h.lat == null || h.lng == null) continue
        markers.push({ _kind: 'gpsjam', _lat: h.lat, _lng: h.lng, color: GPSJAM_COLORS[h.level] || '#ffb300', label: `GPS jam ${h.pct}% · ${h.region}`, size: 12 })
      }
    }
    if (layers.has('infrastructure')) {
      for (const item of infrastructure) {
        markers.push({ _kind: 'infra', _lat: item.lat, _lng: item.lng, color: '#94a3b8', label: item.label, icon: INFRA_ICONS[item.type] || INFRA_ICONS.chokepoint })
      }
    }
    if (layers.has('cascades')) {
      for (const c of cascades) {
        markers.push({ _kind: 'cascade', _lat: c.lat, _lng: c.lng, color: '#f43f5e', label: c.title, icon: CASCADE_ICON, size: 16 })
      }
    }

    globe.htmlElementsData(markers)
  }, [events, webcams, radioStations, flights, fires, weather, cii, gpsjam, infrastructure, cascades])

  return (
    <div className="relative w-full h-full bg-black" ref={containerRef}>
      <div className="absolute bottom-2 right-2 text-[10px] text-gray-500 z-10 pointer-events-none">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline">OpenStreetMap</a> © <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline">Natural Earth</a>
      </div>
    </div>
  )
}
