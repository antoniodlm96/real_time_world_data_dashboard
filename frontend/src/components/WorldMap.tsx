import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { UnifiedEvent, LayerKey } from '../types'

const categoryColors: Record<LayerKey, string> = {
  disaster: '#ff2222',
  conflict: '#00eeff',
  cyber: '#ff44ff',
}

const shapes: Record<LayerKey, string> = {
  disaster: 'circle',
  conflict: 'diamond',
  cyber: 'triangle',
}

function createIcon(color: string, shape: string) {
  let inner: string
  const size = 18
  const half = size / 2
  if (shape === 'diamond') {
    inner = `width:${size}px;height:${size}px;background:${color};transform:rotate(45deg);
      border:3px solid rgba(255,255,255,0.9);
      box-shadow:0 0 12px ${color}, 0 0 4px rgba(0,0,0,0.6);`
  } else if (shape === 'triangle') {
    inner = `width:0;height:0;border-left:${half}px solid transparent;border-right:${half}px solid transparent;
      border-bottom:${size}px solid ${color};
      filter:drop-shadow(0 0 6px ${color}) drop-shadow(0 0 2px rgba(0,0,0,0.6));`
  } else {
    inner = `width:${size}px;height:${size}px;border-radius:50%;background:${color};
      border:3px solid rgba(255,255,255,0.9);
      box-shadow:0 0 12px ${color}, 0 0 4px rgba(0,0,0,0.6);`
  }
  return L.divIcon({
    className: '',
    html: `<div style="${inner}"></div>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [half + 3, half + 3],
  })
}

interface WorldMapProps {
  events: UnifiedEvent[]
  activeLayers: Set<LayerKey>
}

function EventMarkers({ events, activeLayers }: WorldMapProps) {
  const map = useMap()

  useEffect(() => {
    map.invalidateSize()
  }, [map])

  const filtered = useMemo(
    () => events.filter(e => e.location && activeLayers.has(e.category)),
    [events, activeLayers]
  )

  return (
    <>
      {filtered.map(event => (
        <Marker
          key={event.id}
          position={[event.location!.lat, event.location!.lng]}
          icon={createIcon(categoryColors[event.category] || '#6b7280', shapes[event.category] || 'circle')}
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

export default function WorldMap({ events, activeLayers }: WorldMapProps) {
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
    </MapContainer>
  )
}
