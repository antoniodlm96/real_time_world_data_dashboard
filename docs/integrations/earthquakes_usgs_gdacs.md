# Earthquakes & Natural Disasters (USGS + GDACS)

## gdacs-api (official client)
- `pip install gdacs-api`
- `from gdacs.api import GDACSAPIReader`
- `client = GDACSAPIReader()`
- `client.latest_events()` — todos los eventos
- `client.latest_events(event_type="EQ")` — terremotos
- `client.latest_events(event_type="WF")` — incendios
- `client.latest_events(event_type="TC")` — ciclones
- `client.latest_events(event_type="FL")` — inundaciones
- `client.latest_events(event_type="VO")` — volcanes

## USGS GeoJSON feeds
- `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson` (última hora)
- `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` (último día)
- Campos: place, mag, time, url, coordinates (lon, lat, depth)
