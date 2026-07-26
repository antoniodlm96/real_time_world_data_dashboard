import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("weather")

CITIES = [
    {"name": "New York", "country": "United States", "lat": 40.71, "lng": -74.01},
    {"name": "London", "country": "United Kingdom", "lat": 51.51, "lng": -0.13},
    {"name": "Madrid", "country": "Spain", "lat": 40.42, "lng": -3.70},
    {"name": "Paris", "country": "France", "lat": 48.86, "lng": 2.35},
    {"name": "Berlin", "country": "Germany", "lat": 52.52, "lng": 13.41},
    {"name": "Rome", "country": "Italy", "lat": 41.90, "lng": 12.50},
    {"name": "Tokyo", "country": "Japan", "lat": 35.68, "lng": 139.69},
    {"name": "Beijing", "country": "China", "lat": 39.91, "lng": 116.40},
    {"name": "Moscow", "country": "Russia", "lat": 55.76, "lng": 37.62},
    {"name": "Sydney", "country": "Australia", "lat": -33.87, "lng": 151.21},
    {"name": "Cairo", "country": "Egypt", "lat": 30.04, "lng": 31.24},
    {"name": "Mexico City", "country": "Mexico", "lat": 19.43, "lng": -99.13},
    {"name": "Buenos Aires", "country": "Argentina", "lat": -34.60, "lng": -58.38},
    {"name": "São Paulo", "country": "Brazil", "lat": -23.55, "lng": -46.63},
    {"name": "Lagos", "country": "Nigeria", "lat": 6.52, "lng": 3.38},
    {"name": "Dubai", "country": "UAE", "lat": 25.20, "lng": 55.27},
    {"name": "Mumbai", "country": "India", "lat": 19.08, "lng": 72.88},
    {"name": "Singapore", "country": "Singapore", "lat": 1.35, "lng": 103.82},
    {"name": "Istanbul", "country": "Turkey", "lat": 41.01, "lng": 28.98},
    {"name": "Seoul", "country": "South Korea", "lat": 37.57, "lng": 126.98},
]

WMO_CODES: dict[int, tuple[str, str]] = {
    0: ("Clear sky", "☀️"),
    1: ("Mainly clear", "🌤"),
    2: ("Partly cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Foggy", "🌫"),
    48: ("Depositing rime fog", "🌫"),
    51: ("Light drizzle", "🌦"),
    53: ("Moderate drizzle", "🌦"),
    55: ("Dense drizzle", "🌧"),
    56: ("Light freezing drizzle", "🌧"),
    57: ("Dense freezing drizzle", "🌧"),
    61: ("Slight rain", "🌦"),
    63: ("Moderate rain", "🌧"),
    65: ("Heavy rain", "🌧"),
    66: ("Light freezing rain", "🌧"),
    67: ("Heavy freezing rain", "🌧"),
    71: ("Slight snow fall", "🌨"),
    73: ("Moderate snow fall", "🌨"),
    75: ("Heavy snow fall", "❄️"),
    77: ("Snow grains", "❄️"),
    80: ("Slight rain showers", "🌦"),
    81: ("Moderate rain showers", "🌧"),
    82: ("Violent rain showers", "🌧"),
    85: ("Slight snow showers", "🌨"),
    86: ("Heavy snow showers", "🌨"),
    95: ("Thunderstorm", "⛈"),
    96: ("Thunderstorm with slight hail", "⛈"),
    99: ("Thunderstorm with heavy hail", "⛈"),
}


async def fetch_all_weather() -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    results = []

    for city in CITIES:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                url = (
                    f"https://api.open-meteo.com/v1/forecast"
                    f"?latitude={city['lat']}&longitude={city['lng']}"
                    f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,"
                    f"weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl"
                    f"&daily=weather_code,temperature_2m_max,temperature_2m_min,"
                    f"precipitation_sum,wind_speed_10m_max"
                    f"&timezone=UTC"
                )
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning("Open-Meteo %s failed: %s", city["name"], e)
            continue

        current = data.get("current", {})
        daily = data.get("daily", {})

        wmo_code = current.get("weather_code", 0)
        weather_info = WMO_CODES.get(wmo_code, ("Unknown", "❓"))

        severe = False
        if wmo_code in (95, 96, 99, 65, 67, 75, 82, 86):
            severe = True

        results.append({
            "city": city["name"],
            "country": city["country"],
            "lat": city["lat"],
            "lng": city["lng"],
            "temperature": current.get("temperature_2m"),
            "apparent_temperature": current.get("apparent_temperature"),
            "humidity": current.get("relative_humidity_2m"),
            "weather_code": wmo_code,
            "weather_description": weather_info[0],
            "weather_icon": weather_info[1],
            "wind_speed": current.get("wind_speed_10m"),
            "wind_gusts": current.get("wind_gusts_10m"),
            "pressure": current.get("pressure_msl"),
            "severe": severe,
            "forecast": [
                {
                    "date": daily.get("time", [])[i] if i < len(daily.get("time", [])) else "",
                    "temp_max": daily.get("temperature_2m_max", [])[i] if i < len(daily.get("temperature_2m_max", [])) else None,
                    "temp_min": daily.get("temperature_2m_min", [])[i] if i < len(daily.get("temperature_2m_min", [])) else None,
                    "precipitation": daily.get("precipitation_sum", [])[i] if i < len(daily.get("precipitation_sum", [])) else None,
                    "wind_max": daily.get("wind_speed_10m_max", [])[i] if i < len(daily.get("wind_speed_10m_max", [])) else None,
                }
                for i in range(min(7, len(daily.get("time", []))))
            ],
            "timestamp": now,
        })

    logger.info("Weather: %d cities fetched", len(results))
    return results
