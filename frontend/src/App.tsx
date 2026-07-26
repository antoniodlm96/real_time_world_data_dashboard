import { useState, useCallback } from 'react'
import WorldMap from './components/WorldMap'
import SidePanel from './components/SidePanel'
import MarketsPanel from './components/MarketsPanel'
import WebcamPanel from './components/WebcamPanel'
import NewsPanel from './components/NewsPanel'
import RadioPanel from './components/RadioPanel'
import Ticker from './components/Ticker'
import Legend from './components/Legend'
import TimeFilter from './components/TimeFilter'
import { useEvents } from './hooks/useEvents'
import { useMarkets } from './hooks/useMarkets'
import { useWebcams } from './hooks/useWebcams'
import { useNews } from './hooks/useNews'
import { useRadio } from './hooks/useRadio'
import { useFlights } from './hooks/useFlights'
import { useFires } from './hooks/useFires'
import { useCommodities } from './hooks/useCommodities'
import { useWeather } from './hooks/useWeather'
import type { LayerKey, UnifiedEvent } from './types'

export default function App() {
  const [timeHours, setTimeHours] = useState(24)
  const { events, loading, error, refresh: refreshEvents } = useEvents(timeHours)
  const { crypto, forex, refresh: refreshMarkets } = useMarkets()
  const { webcams, countries: wcCountries, selectedCountry: wcSelected, setSelectedCountry: setWcSelected, refresh: refreshWebcams } = useWebcams()
  const { news, countries: newsCountries, selectedCountry: newsSelected, setSelectedCountry: setNewsSelected, refresh: refreshNews } = useNews(timeHours)
  const { stations: radioStations, countries: radioCountries, selectedCountry: radioSelected, setSelectedCountry: setRadioSelected, refresh: refreshRadio } = useRadio()
  const { flights, refresh: refreshFlights } = useFlights()
  const { fires, refresh: refreshFires } = useFires()
  const { commodities, refresh: refreshCommodities } = useCommodities()
  const { weather, refresh: refreshWeather } = useWeather()
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(
    new Set(['disaster', 'conflict', 'cyber'])
  )
  const [panel, setPanel] = useState<'events' | 'markets' | 'webcams' | 'news' | 'radio'>('events')

  const toggleLayer = useCallback((layer: LayerKey) => {
    setActiveLayers(prev => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }, [])

  const handleRefresh = () => {
    refreshEvents()
    refreshMarkets()
    refreshWebcams()
    refreshNews()
    refreshRadio()
    refreshFlights()
    refreshFires()
    refreshCommodities()
    refreshWeather()
  }

  const allEvents: UnifiedEvent[] = Object.values(events).flat()
  const extraLayerCounts: Record<string, number> = {
    webcam: webcams.length,
    radio: radioStations.length,
    flights: flights.length,
    fires: fires.length,
    weather: weather.length,
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <Ticker events={events} />

      <header className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white tracking-tight">
            World Data Dashboard
          </h1>
          <Legend />
        </div>
        <TimeFilter hours={timeHours} onChange={setTimeHours} />
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs text-red-400 bg-red-900/50 px-2 py-1 rounded">
              {error}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-gray-900 border-r border-gray-700 p-4 overflow-y-auto shrink-0 hidden md:block">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPanel('events')}
              className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                panel === 'events'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => setPanel('markets')}
              className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                panel === 'markets'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Markets
            </button>
            <button
              onClick={() => setPanel('webcams')}
              className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                panel === 'webcams'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Webcams
            </button>
            <button
              onClick={() => setPanel('news')}
              className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                panel === 'news'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              News
            </button>
            <button
              onClick={() => setPanel('radio')}
              className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                panel === 'radio'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Radio
            </button>
          </div>
          {panel === 'events' ? (
            <SidePanel
              events={events}
              activeLayers={activeLayers}
              onToggleLayer={toggleLayer}
              extraLayers={extraLayerCounts}
            />
          ) : panel === 'markets' ? (
            <MarketsPanel crypto={crypto} forex={forex} commodities={commodities} news={news} />
          ) : panel === 'webcams' ? (
            <WebcamPanel
              webcams={webcams}
              countries={wcCountries}
              selectedCountry={wcSelected}
              onSelectCountry={setWcSelected}
            />
          ) : panel === 'news' ? (
            <NewsPanel
              news={news}
              countries={newsCountries}
              selectedCountry={newsSelected}
              onSelectCountry={setNewsSelected}
            />
          ) : (
            <RadioPanel
              stations={radioStations}
              countries={radioCountries}
              selectedCountry={radioSelected}
              onSelectCountry={setRadioSelected}
            />
          )}
        </aside>

        <main className="flex-1 relative">
          <div className="absolute inset-0">
            <WorldMap events={allEvents} activeLayers={activeLayers} webcams={webcams} radioStations={radioStations} flights={flights} fires={fires} weather={weather} />
          </div>

          <div className="absolute bottom-4 left-4 right-4 md:hidden">
            <div className="bg-gray-900/90 backdrop-blur rounded-lg p-3">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setPanel('events')}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                    panel === 'events'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Events
                </button>
                <button
                  onClick={() => setPanel('markets')}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                    panel === 'markets'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Markets
                </button>
                <button
                  onClick={() => setPanel('webcams')}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                    panel === 'webcams'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Webcams
                </button>
                <button
                  onClick={() => setPanel('news')}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                    panel === 'news'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  News
                </button>
                <button
                  onClick={() => setPanel('radio')}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                    panel === 'radio'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Radio
                </button>
              </div>
              {panel === 'events' ? (
                <SidePanel
                  events={events}
                  activeLayers={activeLayers}
                  onToggleLayer={toggleLayer}
                  extraLayers={extraLayerCounts}
                />
              ) : panel === 'markets' ? (
                <MarketsPanel crypto={crypto} forex={forex} commodities={commodities} news={news} />
              ) : panel === 'webcams' ? (
                <WebcamPanel
                  webcams={webcams}
                  countries={wcCountries}
                  selectedCountry={wcSelected}
                  onSelectCountry={setWcSelected}
                />
              ) : panel === 'news' ? (
                <NewsPanel
                  news={news}
                  countries={newsCountries}
                  selectedCountry={newsSelected}
                  onSelectCountry={setNewsSelected}
                />
              ) : (
                <RadioPanel
                  stations={radioStations}
                  countries={radioCountries}
                  selectedCountry={radioSelected}
                  onSelectCountry={setRadioSelected}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
