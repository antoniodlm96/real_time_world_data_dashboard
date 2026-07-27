import { useState, useEffect } from 'react'

interface ClockCity {
  name: string
  timezone: string
  flag: string
}

const CITIES: ClockCity[] = [
  { name: 'UTC', timezone: 'Etc/UTC', flag: '🌐' },
  { name: 'London', timezone: 'Europe/London', flag: '🇬🇧' },
  { name: 'Paris/Berlin', timezone: 'Europe/Paris', flag: '🇪🇺' },
  { name: 'Moscow', timezone: 'Europe/Moscow', flag: '🇷🇺' },
  { name: 'Dubai', timezone: 'Asia/Dubai', flag: '🇦🇪' },
  { name: 'New Delhi', timezone: 'Asia/Kolkata', flag: '🇮🇳' },
  { name: 'Beijing', timezone: 'Asia/Shanghai', flag: '🇨🇳' },
  { name: 'Tokyo', timezone: 'Asia/Tokyo', flag: '🇯🇵' },
  { name: 'Sydney', timezone: 'Australia/Sydney', flag: '🇦🇺' },
  { name: 'New York', timezone: 'America/New_York', flag: '🇺🇸' },
  { name: 'Chicago', timezone: 'America/Chicago', flag: '🇺🇸' },
  { name: 'Denver', timezone: 'America/Denver', flag: '🇺🇸' },
  { name: 'Los Angeles', timezone: 'America/Los_Angeles', flag: '🇺🇸' },
  { name: 'Mexico City', timezone: 'America/Mexico_City', flag: '🇲🇽' },
  { name: 'São Paulo', timezone: 'America/Sao_Paulo', flag: '🇧🇷' },
  { name: 'Buenos Aires', timezone: 'America/Argentina/Buenos_Aires', flag: '🇦🇷' },
]

function formatClock(tz: string): { time: string; date: string; offset: string } {
  const now = new Date()
  const locale = navigator.language || 'en-US'

  const time = now.toLocaleTimeString(locale, {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const date = now.toLocaleDateString(locale, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const tzName = now.toLocaleTimeString(locale, {
    timeZone: tz,
    timeZoneName: 'short',
  })
  const offset = tzName.split(' ').pop() || ''

  return { time, date, offset }
}

export default function WorldClocks() {
  const [ticks, setTicks] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTicks(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-3">World Clocks</h2>
      <div className="space-y-1.5">
        {CITIES.map(city => {
          const { time, date, offset } = formatClock(city.timezone)
          const isUTC = city.name === 'UTC'
          return (
            <div
              key={city.timezone}
              className={`flex items-center justify-between px-3 py-2 rounded ${
                isUTC ? 'bg-blue-900/40 border border-blue-700/50' : 'bg-gray-800 hover:bg-gray-750'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">{city.flag}</span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 font-medium truncate">{city.name}</p>
                  <p className="text-xs text-gray-500">{date}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm text-gray-100 font-mono tabular-nums">{time}</p>
                <p className="text-xs text-gray-500">{offset}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
