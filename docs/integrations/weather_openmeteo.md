# Open-Meteo (Clima y Alertas Meteorológicas)

## openmeteo-requests
- `pip install openmeteo-requests requests-cache retry-requests`
- No requiere API key para uso no comercial
- Datos: temperatura, código meteorológico, velocidad del viento, precipitación, etc.

## Uso básico
```python
import openmeteo_requests

openmeteo = openmeteo_requests.Client()
url = "https://api.open-meteo.com/v1/forecast"
params = {
    "latitude": 40.4167,
    "longitude": -3.7037,
    "current": ["temperature_2m", "weather_code", "wind_speed_10m"],
}
responses = openmeteo.weather_api(url, params=params)
current = responses[0].Current()
```

## Alertas meteorológicas
- Open-Meteo también ofrece alerts API para avisos de clima severo
- `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&daily=weather_code&alerts=`
