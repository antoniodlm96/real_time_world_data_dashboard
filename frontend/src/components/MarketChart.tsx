import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, createSeriesMarkers, type IChartApi, type ISeriesApi, type LineData, type Time } from 'lightweight-charts'
import type { NewsArticle } from '../types'

interface MarketChartProps {
  data: { time: number; close: number }[]
  events?: NewsArticle[]
  color?: string
  height?: number
}

export default function MarketChart({ data, events = [], color = '#3b82f6', height = 250 }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#1f2937' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        borderColor: '#4b5563',
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: '#4b5563',
      },
    })

    const series = chart.addSeries(LineSeries, {
      color,
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      crosshairMarkerVisible: true,
    })

    chartRef.current = chart
    seriesRef.current = series

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [height, color])

  useEffect(() => {
    if (!seriesRef.current) return
    const lineData: LineData[] = data.map(d => ({
      time: d.time as Time,
      value: d.close,
    }))
    seriesRef.current.setData(lineData)
  }, [data])

  useEffect(() => {
    if (!seriesRef.current) return
    const markerTimes = new Set(events.map(e => Math.floor(new Date(e.published_at).getTime() / 1000)))
    const markers = data
      .filter(d => markerTimes.has(d.time))
      .map(d => ({
        time: d.time as Time,
        position: 'aboveBar' as const,
        shape: 'arrowUp' as const,
        color: '#f97316',
      }))
    createSeriesMarkers(seriesRef.current!, markers)
  }, [events, data])

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full" />
      {events.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {events.slice(0, 5).map(ev => (
            <span key={ev.id} className="text-[10px] px-2 py-0.5 rounded-full bg-orange-900/30 text-orange-400 border border-orange-700/50">
              ▲ {ev.title.slice(0, 40)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
