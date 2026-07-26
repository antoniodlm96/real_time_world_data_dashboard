# NASA FIRMS (Fire Information for Resource Management System)

## nasa-wildfires (wrapper)
- `pip install nasa-wildfires`
- API key gratuita: https://firms.modaps.eosdis.nasa.gov/api/
- Endpoint: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SENSOR}/{AREA}/{DAYS}`
- Sensores: VIIRS_SNPP_NRT, MODIS_NRT
- Formato: CSV con latitud, longitud, brillo infrarrojo, hora de detección

## gdacs-api (wildfires filter)
- `pip install gdacs-api`
- `from gdacs.api import GDACSAPIReader`
- `client.latest_events(event_type="WF")` para incendios forestales
- Devuelve: eventname, country, alertlevel, GeoJSON geometry

## EFFIS / Copernicus (Europa)
- `https://effis.jrc.ec.europa.eu/geoserver/effis/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=effis:active_fires&outputFormat=application/json`
- Campos: latitude, longitude, area_ha, initial_date
- Se puede usar con geopandas o requests
