import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { UnifiedEvent, LayerKey, Webcam, RadioStation, Flight, Fire } from '../types'

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

interface WorldMapProps {
  events: UnifiedEvent[]
  activeLayers: Set<LayerKey>
  webcams?: Webcam[]
  radioStations?: RadioStation[]
  flights?: Flight[]
  fires?: Fire[]
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
                Source: {event.source} |{' '}
                {new Date(event.timestamp).toLocaleString()}
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

export default function WorldMap({ events, activeLayers, webcams = [], radioStations = [], flights = [], fires = [] }: WorldMapProps) {
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
    </MapContainer>
  )
}
