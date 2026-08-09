export interface EventLocation {
  lat: number
  lng: number
  place?: string
}

export interface UnifiedEvent {
  id: string
  category: 'disaster' | 'conflict' | 'cyber'
  title: string
  description?: string
  location?: EventLocation
  country?: string
  magnitude?: number
  timestamp: string
  source: string
  source_url?: string
  severity?: string
}

export interface CryptoEntry {
  id: string
  name: string
  symbol: string
  current_price: number
  market_cap?: number
  price_change_24h?: number
  last_updated: string
}

export interface ForexData {
  base: string
  rates: Record<string, number>
  date: string
  last_updated: string
}

export interface MarketData {
  crypto: CryptoEntry[]
  forex: ForexData | null
  last_updated: string
}

export interface EventsResponse {
  events: UnifiedEvent[]
  count: number
}

export interface CryptoResponse {
  crypto: CryptoEntry[]
  count: number
}

export interface ForexResponse {
  forex: ForexData
}

export interface Webcam {
  id: string
  title: string
  url: string
  platform: string
  country?: string
  province?: string
  city?: string
  lat?: number
  lng?: number
  thumbnail_url?: string
  is_active: boolean
  last_checked?: string
  created_at: string
}

export interface NewsArticle {
  id: string
  title: string
  description?: string
  url: string
  image_url?: string
  source_name: string
  source_country?: string
  published_at: string
  category?: string
  translated_title?: string
  cluster_id?: string
}

export interface RadioStation {
  id: string
  name: string
  frequency?: string
  description?: string
  stream_url: string
  country?: string
  country_code?: string
  state?: string
  language?: string
  tags?: string
  codec?: string
  bitrate?: number
  homepage?: string
  favicon?: string
  geo_lat?: number
  geo_lng?: number
}

export interface Flight {
  id: string
  icao24?: string
  callsign?: string
  origin_country?: string
  lat: number
  lng: number
  altitude: number
  speed: number
  heading: number
  timestamp: string
}

export interface Fire {
  id: string
  lat: number
  lng: number
  brightness: number
  frp: number
  confidence: string
  satellite: string
  acq_date: string
  acq_time: string
  timestamp: string
}

export interface CommoditySeries {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CommodityEntry {
  symbol: string
  name: string
  current_price: number
  previous_close: number
  change: number
  change_pct: number
  currency: string
  series: CommoditySeries[]
}

export interface WeatherForecast {
  date: string
  temp_max: number
  temp_min: number
  precipitation: number
  wind_max: number
}

export interface WeatherEntry {
  city: string
  country: string
  lat: number
  lng: number
  temperature: number
  apparent_temperature: number
  humidity: number
  weather_code: number
  weather_description: string
  weather_icon: string
  wind_speed: number
  wind_gusts: number
  pressure: number
  severe: boolean
  forecast: WeatherForecast[]
  timestamp: string
}

export type LayerKey = 'disaster' | 'conflict' | 'cyber' | 'webcam' | 'radio' | 'flights' | 'fires' | 'weather' | 'cii' | 'gpsjam' | 'infrastructure' | 'cascades' | 'prediction'

export interface CiiScore {
  country: string
  score: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  provenance: string
  components: { conflict: number; disaster: number; cyber: number; weather: number; news: number }
  counts: { conflict: number; disaster: number; cyber: number }
  lat?: number
  lng?: number
}

export interface PredictionOutcome {
  name: string
  price?: number
}

export interface PredictionMarket {
  id: string
  condition_id?: string
  question: string
  slug?: string
  outcomes: PredictionOutcome[]
  volume24hr: number
  end_date?: string
  last_trade_price?: string
  category?: string
  url?: string
}

export interface GpsJamHex {
  h3: string
  lat?: number
  lng?: number
  level: 'high' | 'medium' | 'low'
  pct: number
  affectedAircraft: number
  totalAircraft: number
  region: string
}

export interface InfrastructureItem {
  id: string
  type: 'port' | 'military' | 'pipeline' | 'cable' | 'chokepoint'
  label: string
  lat: number
  lng: number
  country: string
  criticality: number
}

export interface CascadeAlert {
  id: string
  title: string
  description: string
  lat: number
  lng: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  distance_km: number
  events: string[]
  categories: string[]
  timestamp: string
}

export interface SourceHealth {
  name: string
  status: 'ok' | 'stale' | 'unknown'
  last_success?: string
  last_failure?: string
  last_attempt?: string
  age_min?: number
  max_stale_min: number
  source_version: string
  success_count: number
  failure_count: number
}
