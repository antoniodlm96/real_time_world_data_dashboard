import type { UnifiedEvent } from '../types'

export type EventCategory = 'disaster' | 'conflict' | 'cyber'

export interface CountryGroup {
  country: string
  lat: number
  lng: number
  total: number
  categories: { category: EventCategory; count: number }[]
  events: UnifiedEvent[]
}

export function groupEventsByCountry(events: UnifiedEvent[]): {
  groups: CountryGroup[]
  singles: UnifiedEvent[]
} {
  const byCountry = new Map<string, UnifiedEvent[]>()
  for (const e of events) {
    if (e.country && e.location) {
      const arr = byCountry.get(e.country)
      if (arr) arr.push(e)
      else byCountry.set(e.country, [e])
    }
  }

  const groups: CountryGroup[] = []
  const singles: UnifiedEvent[] = []

  for (const [country, evs] of byCountry) {
    if (evs.length < 2) {
      singles.push(...evs)
      continue
    }
    const withLoc = evs.filter(e => e.location)
    const lat = withLoc.reduce((s, e) => s + (e.location!.lat || 0), 0) / withLoc.length
    const lng = withLoc.reduce((s, e) => s + (e.location!.lng || 0), 0) / withLoc.length
    const catCounts = new Map<EventCategory, number>()
    for (const e of evs) {
      catCounts.set(e.category, (catCounts.get(e.category) || 0) + 1)
    }
    groups.push({
      country,
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
