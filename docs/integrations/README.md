# Integraciones de Datos

Referencias de APIs y librerías para fuentes de datos en tiempo real.

## Estado actual
| Fuente | Implementado | Notas |
|--------|-------------|-------|
| USGS Earthquakes | ✅ | Directo vía GeoJSON API |
| GDACS RSS (todos) | ✅ | Polling cada 5 min |
| Bluesky Firehose | ✅ | WebSocket Jetstream oficial |
| RSS News Feeds | ✅ | 76 feeds vía feedparser |
| OpenSky Flights | ✅ | API directa |
| NASA FIRMS (API key) | ❌ | Pendiente de API key |
| EFFIS/Copernicus | ❌ | No implementado |
| Open-Meteo Weather | ❌ | No implementado |
| gdacs-api library | ❌ | Alternativa a GDACS RSS |
| atproto library | ❌ | Alternativa a Jetstream raw |

## Pendientes de implementar
1. NASA FIRMS - con API key gratuita
2. EFFIS - incendios Europa
3. Open-Meteo - clima y alertas
4. gdacs-api - como reemplazo/mejora del RSS actual
