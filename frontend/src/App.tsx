import { useState, useCallback, Suspense, lazy } from 'react'
import WorldMap from './components/WorldMap'
import GlobeMap from './components/GlobeMap'
import SidePanel from './components/SidePanel'
import MarketsPanel from './components/MarketsPanel'
import WebcamPanel from './components/WebcamPanel'
import NewsPanel from './components/NewsPanel'
import RadioPanel from './components/RadioPanel'
import WorldClocks from './components/WorldClocks'
import AdminPanel from './components/AdminPanel'
import Ticker from './components/Ticker'
import Legend from './components/Legend'
import TimeFilter from './components/TimeFilter'
import CiiPanel from './components/CiiPanel'
import PredictionPanel from './components/PredictionPanel'
import { useEvents } from './hooks/useEvents'
import { useMarkets } from './hooks/useMarkets'
import { useWebcams } from './hooks/useWebcams'
import { useNews } from './hooks/useNews'
import { useRadio } from './hooks/useRadio'
import { useFlights } from './hooks/useFlights'
import { useFires } from './hooks/useFires'
import { useCommodities } from './hooks/useCommodities'
import { useWeather } from './hooks/useWeather'
import { useCii } from './hooks/useCii'
import { useGpsJam } from './hooks/useGpsJam'
import { usePrediction } from './hooks/usePrediction'
import { useInfrastructure } from './hooks/useInfrastructure'
import { useCascades } from './hooks/useCascades'
import type { LayerKey, UnifiedEvent } from './types'

const LazyGlobeMap = lazy(() => import('./components/GlobeMap'))

type PanelKey = 'events' | 'markets' | 'webcams' | 'news' | 'radio' | 'clocks' | 'cii' | 'prediction' | 'admin'

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
  const { scores: ciiScores, refresh: refreshCii } = useCii()
  const { hexes: gpsjam, refresh: refreshGpsJam } = useGpsJam()
  const { markets: predictionMarkets, refresh: refreshPrediction } = usePrediction()
  const { items: infrastructure, refresh: refreshInfrastructure } = useInfrastructure()
  const { cascades, refresh: refreshCascades } = useCascades()
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(
    new Set(['disaster', 'conflict', 'cyber'])
  )
  const [panel, setPanel] = useState<PanelKey>('events')
  const [mapMode, setMapMode] = useState<'globe' | 'flat'>('globe')

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
    refreshCii()
    refreshGpsJam()
    refreshPrediction()
    refreshInfrastructure()
    refreshCascades()
  }

  const allEvents: UnifiedEvent[] = Object.values(events).flat()
  const extraLayerCounts: Record<string, number> = {
    webcam: webcams.length,
    radio: radioStations.length,
    flights: flights.length,
    fires: fires.length,
    weather: weather.length,
    cii: ciiScores.length,
    gpsjam: gpsjam.length,
    infrastructure: infrastructure.length,
    cascades: cascades.length,
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
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-red-400 bg-red-900/50 px-2 py-1 rounded">
                {error}
              </span>
            )}
            <button
              onClick={() => setPanel(p => p === 'admin' ? 'events' : 'admin')}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                panel === 'admin'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {panel === 'admin' ? 'Dashboard' : 'Admin'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </header>

      {panel === 'admin' ? (
        <div className="flex-1 bg-gray-900 p-6 min-h-0">
          <AdminPanel />
        </div>
      ) : (
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
              <button
                onClick={() => setPanel('clocks')}
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                  panel === 'clocks'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Clocks
              </button>
              <button
                onClick={() => setPanel('cii')}
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                  panel === 'cii'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                CII
              </button>
              <button
                onClick={() => setPanel('prediction')}
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                  panel === 'prediction'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Prediction
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
            ) : panel === 'clocks' ? (
              <WorldClocks />
            ) : panel === 'cii' ? (
              <CiiPanel scores={ciiScores} />
            ) : panel === 'prediction' ? (
              <PredictionPanel markets={predictionMarkets} />
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
              {mapMode === 'globe' ? (
                <Suspense fallback={<div className="w-full h-full bg-black flex items-center justify-center text-xs text-gray-500">Loading 3D globe…</div>}>
                  <LazyGlobeMap
                  events={allEvents}
                  activeLayers={activeLayers}
                  webcams={webcams}
                  radioStations={radioStations}
                  flights={flights}
                  fires={fires}
                  weather={weather}
                  cii={ciiScores}
                  gpsjam={gpsjam}
                  infrastructure={infrastructure}
                  cascades={cascades}
                />
                </Suspense>
              ) : (
                <WorldMap
                  events={allEvents}
                  activeLayers={activeLayers}
                  webcams={webcams}
                  radioStations={radioStations}
                  flights={flights}
                  fires={fires}
                  weather={weather}
                  cii={ciiScores}
                  gpsjam={gpsjam}
                  infrastructure={infrastructure}
                  cascades={cascades}
                />
              )}
            </div>

            <button
              onClick={() => setMapMode(m => m === 'globe' ? 'flat' : 'globe')}
              className="absolute top-3 right-3 z-[1000] text-xs px-3 py-1.5 rounded font-medium bg-gray-800/90 text-gray-200 border border-gray-600 hover:bg-gray-700 transition-colors"
            >
              {mapMode === 'globe' ? '🌐 3D Globe' : '🗺️ Flat Map'}
            </button>

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
                  <button
                    onClick={() => setPanel('clocks')}
                    className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                      panel === 'clocks'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Clocks
                  </button>
                  <button
                    onClick={() => setPanel('cii')}
                    className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                      panel === 'cii'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    CII
                  </button>
                  <button
                    onClick={() => setPanel('prediction')}
                    className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${
                      panel === 'prediction'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Prediction
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
                ) : panel === 'clocks' ? (
                  <WorldClocks />
                ) : panel === 'cii' ? (
                  <CiiPanel scores={ciiScores} />
                ) : panel === 'prediction' ? (
                  <PredictionPanel markets={predictionMarkets} />
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
      )}
    </div>
  )
}
