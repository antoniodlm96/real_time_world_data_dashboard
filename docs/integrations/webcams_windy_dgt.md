# Webcams — Fuentes Avanzadas

## 1. Windy Webcams (API oficial / Lookr)
- 50.000+ cámaras geolocalizadas globales
- API Key gratuita: https://api-windy-com.translate.goog/webcams/docs
- Endpoint: `https://api.windy.com/webcams/v3/webcams`
- Header: `x-windy-api-key`
- Parámetros: limit, include (urls,location,images), countries, bbox
- Devuelve: title, location.city, location.latitude, location.longitude, images.current.preview

```python
import requests

API_KEY = "tu_api_key_de_windy"
url = "https://api.windy.com/webcams/v3/webcams"
headers = {"x-windy-api-key": API_KEY}
params = {"limit": 10, "include": "urls,location,images", "countries": "ES"}
response = requests.get(url, headers=headers, params=params).json()
```

## 2. DGT (Dirección General de Tráfico) — España
- Feed XML público sin API key
- `https://nap.dgt.es/datoscamaras/CamarasDGT.xml`
- Campos: Nombre, URL (imagen JPEG), Posicion/Latitud, Posicion/Longitud
- Sin autenticación

```python
import requests
import xml.etree.ElementTree as ET

url = "https://nap.dgt.es/datoscamaras/CamarasDGT.xml"
response = requests.get(url)
root = ET.fromstring(response.content)
```

## 3. streamlink (YouTube Live / Twitch → HLS)
- Extrae URL .m3u8 directa desde páginas de streaming
- `pip install streamlink`
- Útil para webcams 24/7 en YouTube (plazas, volcanes, estación espacial)

```python
import streamlink
streams = streamlink.streams("https://www.youtube.com/watch?v=VIDEO_ID")
hls_url = streams["best"].url
```

## 4. pyinsecam (Cámaras IP abiertas)
- Cámaras de red públicas (MJPEG/RTSP)
- Sin librería oficial en PyPI, scraping con BeautifulSoup

## Recomendación arquitectura
- Backend: solo metadatos (coordenadas, título, URL de imagen/stream)
- Frontend: renderiza directamente con `<img>` refresco automático o hls.js
- No pasar el vídeo por el servidor Python
