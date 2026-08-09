import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet'
import L from 'leaflet'
import { cellToBoundary } from 'h3-js'
import type { UnifiedEvent, LayerKey, Webcam, RadioStation, Flight, Fire, WeatherEntry, GpsJamHex, InfrastructureItem, CascadeAlert, CiiScore } from '../types'

const categoryColors: Record<string, string> = {
  disaster: '#ff2222',
  conflict: '#00eeff',
  cyber: '#ff44ff',
}

const shapes: Record<string, string> = {
  disaster: 'circle',
  conflict: 'diamond',
  cyber: 'triangle',
}

function createIcon(color: string, shape: string, magnitude?: number | null, borderColor?: string) {
  const base = shape === 'circle' && magnitude != null
    ? Math.max(4, 4 + magnitude * 2.5)
    : 12
  const size = Math.round(base)
  const half = size / 2
  const border = Math.min(3, Math.round(size / 6))
  const glow = Math.min(16, Math.round(size * 0.75))
  const bColor = borderColor || 'rgba(255,255,255,0.9)'
  let inner: string
  if (shape === 'diamond') {
    inner = `width:${size}px;height:${size}px;background:${color};transform:rotate(45deg);
      border:${border}px solid ${bColor};
      box-shadow:0 0 ${glow}px ${color}, 0 0 4px rgba(0,0,0,0.6);`
  } else if (shape === 'triangle') {
    inner = `width:0;height:0;border-left:${half}px solid transparent;border-right:${half}px solid transparent;
      border-bottom:${size}px solid ${color};
      filter:drop-shadow(0 0 ${glow / 2}px ${color}) drop-shadow(0 0 2px rgba(0,0,0,0.6));`
  } else {
    inner = `width:${size}px;height:${size}px;border-radius:50%;background:${color};
      border:${border}px solid ${bColor};
      box-shadow:0 0 ${glow}px ${color}, 0 0 4px rgba(0,0,0,0.6);`
  }
  const pad = border * 2 + 2
  return L.divIcon({
    className: '',
    html: `<div style="${inner}"></div>`,
    iconSize: [size + pad, size + pad],
    iconAnchor: [half + pad / 2, half + pad / 2],
  })
}

function markerSvg(path: string, color: string, size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="rgba(255,255,255,0.9)" stroke-width="1.5">
    <path d="${path}"/>
  </svg>`
}

function layerIcon(svg: string) {
  return L.divIcon({
    className: '',
    html: `<div style="filter:drop-shadow(0 0 4px rgba(0,0,0,0.7))">${svg}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

const WEBCAM_ICON = markerSvg('M12 2C9.2 2 7 4.2 7 7c0 3.5 5 10 5 10s5-6.5 5-10c0-2.8-2.2-5-5-5zm0 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z', '#22d3ee')
const RADIO_ICON = markerSvg('M3.24 6.15C2.46 5.64 2 4.86 2 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M3 2v20M21 2v20M8 6.15C7.46 5.64 7 4.86 7 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M8 2v20M15 2v20M14 6.15C13.46 5.64 13 4.86 13 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M15 21c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z', '#fbbf24')
const FLIGHT_ICON = markerSvg('M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z', '#a78bfa')

const FIRE_ICON = markerSvg('M12 2C9.5 5.5 6 9 6 13c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-3.5-7.5-6-11z', '#ff6600')
const WEATHER_ICON = markerSvg('M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z', '#60a5fa')

interface WorldMapProps {
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
}

function EventMarkers({ events, activeLayers }: { events: UnifiedEvent[]; activeLayers: Set<LayerKey> }) {
  const filtered = useMemo(
    () => events.filter(e => e.location && activeLayers.has(e.category as LayerKey)),
    [events, activeLayers]
  )

  return (
    <>
      {filtered.map(event => (
        <Marker
          key={event.id}
          position={[event.location!.lat, event.location!.lng]}
          icon={createIcon(
            categoryColors[event.category] || '#6b7280',
            shapes[event.category] || 'circle',
            event.magnitude,
            event.source === 'USGS' ? '#ffdd00' : undefined,
          )}
        >
          <Popup>
            <div className="text-sm max-w-[200px]">
              <strong className="text-gray-900">{event.title}</strong>
              {event.description && (
                <p className="text-gray-600 mt-1">{event.description}</p>
              )}
              {event.magnitude && (
                <p className="text-gray-700 mt-1">
                  Magnitude: <strong>{event.magnitude}</strong>
                </p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                Source: {event.source}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                UTC: {new Date(event.timestamp).toUTCString().slice(5, -4)}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Local: {new Date(event.timestamp).toLocaleString()}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function WebcamMarkers({ webcams, visible }: { webcams: Webcam[]; visible: boolean }) {
  if (!visible) return null
  return (
    <>
      {webcams.filter(w => w.lat && w.lng).map(w => (
        <Marker key={w.id} position={[w.lat!, w.lng!]} icon={layerIcon(WEBCAM_ICON)}>
          <Popup>
            <div className="text-sm max-w-[220px]">
              {w.thumbnail_url && (
                <img src={w.thumbnail_url} alt="" className="w-full h-24 object-cover rounded mb-2"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
              <strong className="text-gray-900">{w.title}</strong>
              <p className="text-gray-500 text-xs mt-1">
                {w.country}{w.city ? ` · ${w.city}` : ''} | {w.platform}
              </p>
              <a href={w.url} target="_blank" rel="noopener noreferrer"
                className="text-blue-600 text-xs block mt-1 hover:underline">View Webcam ↗</a>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function RadioMarkers({ stations, visible }: { stations: RadioStation[]; visible: boolean }) {
  if (!visible) return null
  return (
    <>
      {stations.filter(s => s.geo_lat && s.geo_lng).map(s => (
        <Marker key={s.id} position={[s.geo_lat!, s.geo_lng!]} icon={layerIcon(RADIO_ICON)}>
          <Popup>
            <div className="text-sm max-w-[200px]">
              <strong className="text-gray-900">{s.name}</strong>
              <p className="text-gray-500 text-xs mt-1">
                {s.country}{s.state ? ` · ${s.state}` : ''}{s.language ? ` · ${s.language}` : ''}
              </p>
              {s.frequency && <p className="text-yellow-700 text-xs font-mono mt-1">{s.frequency}</p>}
              {s.stream_url && (
                <audio src={s.stream_url} controls className="w-full mt-2 h-8" />
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function FlightMarkers({ flights, visible }: { flights: Flight[]; visible: boolean }) {
  if (!visible) return null
  return (
    <>
      {flights.map(f => (
        <Marker key={f.id} position={[f.lat, f.lng]} icon={layerIcon(FLIGHT_ICON)}>
          <Popup>
            <div className="text-sm max-w-[200px]">
              <strong className="text-gray-900">{f.callsign || 'Unknown flight'}</strong>
              <p className="text-gray-500 text-xs mt-1">
                Alt: {f.altitude.toLocaleString()} ft · Speed: {f.speed} m/s · Heading: {f.heading}°
              </p>
              <p className="text-gray-500 text-xs mt-1">Origin: {f.origin_country || 'Unknown'}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function FireMarkers({ fires, visible }: { fires: Fire[]; visible: boolean }) {
  if (!visible) return null
  const filtered = fires.filter(f => f.lat && f.lng)
  return (
    <>
      {filtered.map(f => (
        <Marker key={f.id} position={[f.lat, f.lng]} icon={layerIcon(FIRE_ICON)}>
          <Popup>
            <div className="text-sm max-w-[200px]">
              <strong className="text-gray-900">Active Fire</strong>
              <p className="text-gray-500 text-xs mt-1">
                Satellite: {f.satellite} · Confidence: {f.confidence}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Brightness: {f.brightness.toFixed(1)}K · FRP: {f.frp.toFixed(1)} MW
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Acquired: {f.acq_date} {f.acq_time}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function WeatherMarkers({ weather, visible }: { weather: WeatherEntry[]; visible: boolean }) {
  if (!visible) return null
  return (
    <>
      {weather.map(w => (
        <Marker key={`${w.lat}-${w.lng}`} position={[w.lat, w.lng]} icon={layerIcon(WEATHER_ICON)}>
          <Popup>
            <div className="text-sm max-w-[200px]">
              <strong className="text-gray-900">{w.city}, {w.country}</strong>
              <p className="text-lg font-bold text-gray-100 mt-1">
                {w.weather_icon} {w.temperature}°C
              </p>
              <p className="text-gray-500 text-xs">{w.weather_description}</p>
              <p className="text-gray-500 text-xs mt-1">
                Feels like: {w.apparent_temperature}°C · Humidity: {w.humidity}%
              </p>
              <p className="text-gray-500 text-xs">
                Wind: {w.wind_speed} km/h · Pressure: {w.pressure} hPa
              </p>
              {w.severe && (
                <p className="text-red-400 text-xs font-bold mt-1">⚠ Severe weather alert</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
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

const INFRA_ICONS: Record<string, string> = {
  port: 'M11 9h4v6h-4V9zm-6 0h4v6H5V9zm12 0h4v6h-4V9z',
  military: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4zm0 2.5L6 7.5v4.5c0 3.8 2.5 6.3 6 8 3.5-1.7 6-4.2 6-8V7.5l-6-3z',
  pipeline: 'M12 3v18M8 3v18M4 3v18M16 3v18M20 3v18',
  cable: 'M12 2a7 7 0 0 0-7 7v6a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7zm0 2a5 5 0 0 1 5 5v6a5 5 0 0 1-10 0V9a5 5 0 0 1 5-5z',
  chokepoint: 'M4 5h16v14H4zM6 7v10h12V7H6zm3 2h6v2H9V9zm0 4h6v2H9v-2z',
}

const CASCADE_ICON = markerSvg('M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z', '#f43f5e')

function GpsJamLayer({ hexes, visible }: { hexes: GpsJamHex[]; visible: boolean }) {
  if (!visible) return null
  return (
    <>
      {hexes.map(h => {
        let boundary: [number, number][]
        try {
          boundary = cellToBoundary(h.h3).map(([lat, lng]) => [lat, lng] as [number, number])
        } catch {
          return null
        }
        return (
          <Polygon
            key={h.h3}
            positions={boundary}
            pathOptions={{
              color: GPSJAM_COLORS[h.level] || '#888',
              weight: 1,
              fillColor: GPSJAM_COLORS[h.level] || '#888',
              fillOpacity: 0.4,
            }}
          >
            <Popup>
              <div className="text-sm max-w-[200px]">
                <strong className="text-gray-900">GPS interference</strong>
                <p className="text-gray-600 mt-1">{h.pct}% of aircraft report degraded navigation</p>
                <p className="text-gray-500 text-xs mt-1">
                  {h.affectedAircraft} of {h.totalAircraft} aircraft · {h.region}
                </p>
              </div>
            </Popup>
          </Polygon>
        )
      })}
    </>
  )
}

function InfrastructureLayer({ items, visible }: { items: InfrastructureItem[]; visible: boolean }) {
  if (!visible) return null
  return (
    <>
      {items.map(item => (
        <Marker key={item.id} position={[item.lat, item.lng]} icon={layerIcon(markerSvg(INFRA_ICONS[item.type] || INFRA_ICONS.chokepoint, '#94a3b8'))}>
          <Popup>
            <div className="text-sm max-w-[200px]">
              <strong className="text-gray-900">{item.label}</strong>
              <p className="text-gray-500 text-xs mt-1">{item.country}</p>
              <p className="text-gray-500 text-xs">Criticality: {(item.criticality * 100).toFixed(0)}%</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function CascadeLayer({ cascades, visible }: { cascades: CascadeAlert[]; visible: boolean }) {
  if (!visible) return null
  return (
    <>
      {cascades.map(c => (
        <Marker key={c.id} position={[c.lat, c.lng]} icon={layerIcon(CASCADE_ICON)}>
          <Popup>
            <div className="text-sm max-w-[220px]">
              <strong className="text-gray-900">{c.title}</strong>
              <p className="text-gray-600 mt-1">{c.description}</p>
              <p className="text-gray-500 text-xs mt-1">
                Severity: {c.severity} · ~{c.distance_km} km
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function CiiLayer({ scores, visible }: { scores: CiiScore[]; visible: boolean }) {
  if (!visible) return null
  const mapped = scores.filter(s => s.lat != null && s.lng != null)
  return (
    <>
      {mapped.map(s => (
        <Marker key={s.country} position={[s.lat!, s.lng!]} icon={createIcon(CII_COLORS[s.severity] || '#888', 'circle', 4 + s.score / 25)}>
          <Popup>
            <div className="text-sm max-w-[200px]">
              <strong className="text-gray-900">{s.country}</strong>
              <p className="text-lg font-bold text-gray-900 mt-1">CII {s.score.toFixed(1)}</p>
              <p className="text-gray-500 text-xs">{s.severity}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

export default function WorldMap({ events, activeLayers, webcams = [], radioStations = [], flights = [], fires = [], weather = [], cii = [], gpsjam = [], infrastructure = [], cascades = [] }: WorldMapProps) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      className="w-full h-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <EventMarkers events={events} activeLayers={activeLayers} />
      <WebcamMarkers webcams={webcams} visible={activeLayers.has('webcam')} />
      <RadioMarkers stations={radioStations} visible={activeLayers.has('radio')} />
      <FlightMarkers flights={flights} visible={activeLayers.has('flights')} />
      <FireMarkers fires={fires} visible={activeLayers.has('fires')} />
      <WeatherMarkers weather={weather} visible={activeLayers.has('weather')} />
      <CiiLayer scores={cii} visible={activeLayers.has('cii')} />
      <GpsJamLayer hexes={gpsjam} visible={activeLayers.has('gpsjam')} />
      <InfrastructureLayer items={infrastructure} visible={activeLayers.has('infrastructure')} />
      <CascadeLayer cascades={cascades} visible={activeLayers.has('cascades')} />
    </MapContainer>
  )
}
