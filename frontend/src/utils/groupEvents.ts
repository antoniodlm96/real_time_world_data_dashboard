import type { UnifiedEvent } from '../types'

export type EventCategory = 'disaster' | 'conflict' | 'cyber'

export interface CountryGroup {
  country: string | null
  lat: number
  lng: number
  total: number
  categories: { category: EventCategory; count: number }[]
  events: UnifiedEvent[]
}

// Group events that share the same map position (rounded to ~1km). USGS
// and other precisely-geolocated events keep their exact spot; only truly
// colocated points (e.g. news/posts pinned to a country centroid) collapse
// into a single marker with a count badge.
const CELL = 0.01

function cellKey(lat: number, lng: number): string {
  return `${Math.round(lat / CELL)},${Math.round(lng / CELL)}`
}

export function groupEventsByCountry(events: UnifiedEvent[]): {
  groups: CountryGroup[]
  singles: UnifiedEvent[]
} {
  const byCell = new Map<string, UnifiedEvent[]>()
  const singles: UnifiedEvent[] = []

  for (const e of events) {
    if (!e.location) continue
    const key = cellKey(e.location.lat, e.location.lng)
    const arr = byCell.get(key)
    if (arr) arr.push(e)
    else byCell.set(key, [e])
  }

  const groups: CountryGroup[] = []
  for (const [key, evs] of byCell) {
    if (evs.length < 2) {
      singles.push(...evs)
      continue
    }
    const [latC, lngC] = key.split(',')
    const lat = Number(latC) * CELL
    const lng = Number(lngC) * CELL
    const catCounts = new Map<EventCategory, number>()
    for (const e of evs) {
      catCounts.set(e.category, (catCounts.get(e.category) || 0) + 1)
    }
    groups.push({
      country: evs.find(e => e.country)?.country ?? null,
      lat,
      lng,
      total: evs.length,
      categories: [...catCounts.entries()].map(([category, count]) => ({ category, count })),
      events: evs,
    })
  }

  return { groups, singles }
}

const CATEGORY_OFFSETS: [number, number][] = [
  [0, 0],
  [0.4, 0.4],
  [-0.4, 0.4],
]

export function categoryOffset(index: number): [number, number] {
  return CATEGORY_OFFSETS[index % CATEGORY_OFFSETS.length]
}
