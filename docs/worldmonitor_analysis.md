# World Monitor — Análisis en profundidad

> Análisis del proyecto ajeno [`worldmonitor-main`](../other_projects/worldmonitor-main) (repo original `koala73/worldmonitor`, AGPL v3).
> Objetivo: entender fuentes de datos, pipeline de procesamiento (incl. AI/ML), construcción del frontend y presentación, para decidir después qué funcionalidades portar a `real_time_world_data_dashboard`.

---

## 1. Resumen ejecutivo

World Monitor es un **dashboard SPA de inteligencia global en tiempo real** escrito en TypeScript (Vite + Preact como base, pero con componentes propios sin framework). Agrega datos de geopolítica, militar, finanzas, clima, ciber, marítimo y aviación desde **35 grupos de fuentes con seguimiento de frescura** y los presenta en una cuadrícula de paneles sobre dos mapas (deck.gl y globe.gl).

Arquitectura en dos mitades:

- **Vercel Edge Functions** (`api/`, 146 ficheros, JS autocontenido) → sirven los `/api/*` con caché Redis y lectura de datos semilla.
- **Railway relay + seeders** (`scripts/ais-relay.cjs` de 12.688 líneas + ~150 `scripts/seed-*.mjs`) → recogen datos de upstream con TLS/JA3 evasión, escriben a Redis Upstash.

Todo el frontend se construye en `src/` (186 componentes TS top-level, 229 módulos de servicio), orquestado por `src/app/` con polling inteligente y layout de paneles persistido.

---

## 2. Arquitectura y despliegue

Topología (fuente: `ARCHITECTURE.md`):

```
Browser/Desktop (Tauri)
   │ fetch /api/*
   ▼
Vercel Edge Functions ──► Redis Upstash (lectura, cachedFetchJson)
        ▲                        ▲
        │                        │ escribe
        └── Railway relay + seeders (ais-relay.cjs + seed-*.mjs)
```

- **Web**: Vercel, deploy automático al push a `main`.
- **Relay/Seeders**: Railway (Docker + cron).
- **Desktop**: Tauri (Rust + sidecar Node.js en `src-tauri/`).
- **Docs**: Mintlify (`docs/`), proxied por Vercel en `/docs`.

### 2.1 Reglas de capas (fuente: `AGENTS.md`)

```
types -> config -> services -> components -> app -> App.ts
```

- `types/` sin imports internos.
- `config/` importa solo de `types/`.
- `api/*.js` son Edge Functions **JS autocontenido**: NO pueden importar de `../src/` ni `../server/`; solo helpers `_*.js` del mismo directorio y paquetes npm. Verificado por `tests/edge-functions.test.mjs` y pre-push esbuild.
- `server/` se embebe en las Edge Functions vía gateway al desplegar.

### 2.2 El patrón "relay" (clave)

- El relay de Railway (`scripts/ais-relay.cjs`) es quien hace las llamadas a upstream difíciles (JA3 bloqueo, WAF, rate limits). El navegador **nunca** toca los upstream directamente.
- El frontend (Edge Functions) lee vía `cachedFetchJson()` con **stampede protection** (coalesce misses concurrentes).
- `server/_shared/relay.ts:3` `getRelayBaseUrl()` lee `WS_RELAY_URL`; `relay.ts:9` `getRelayHeaders()` añade `x-relay-key` (o el header de `RELAY_AUTH_HEADER`) con el `RELAY_SHARED_SECRET`.

### 2.3 Rutas del relay (fuente: `scripts/ais-relay.cjs`, líneas 10911-10942)

| Ruta | Handler | Uso |
|---|---|---|
| `/ais/snapshot` | `handleSnapshotRequest` | Snapshot AIS naval |
| `/ucdp-events` | `handleUcdpEventsRequest` | Conflictos UCDP |
| `/wingbits/track` | `handleWingbitsTrackRequest` | ADS-B vía Wingbits |
| `/opensky` | `handleOpenSkyRequest` | ADS-B vía OpenSky |
| `/worldbank` | `handleWorldBankRequest` | Indicadores World Bank |
| `/polymarket` | `handlePolymarketRequest` | Mercados de predicción |
| `/youtube-live` | `handleYouTubeLiveRequest` | Webcams YouTube |
| `/yahoo-chart` | `handleYahooChartRequest` | Charts Yahoo Finance (150ms stagger) |
| `/crypto-quotes` | `handleCryptoQuotesRequest` | Cotizaciones crypto |
| `/notam` | `handleNotamProxyRequest` | ICAO NOTAM |
| `/aviationstack` | `handleAviationStackRequest` | API aviación |
| `/google-flights/search` | `handleGoogleFlightsSearch` | Búsqueda de vuelos |
| `/google-flights/search-dates` | `handleGoogleFlightsDates` | Calendario de precios |
| `/rss` | `handleRssRequest` | Proxy RSS con allow-list |
| `/telegram` | `handleTelegramFeedRequest` | Feed OSINT Telegram |
| `/oref` | `handleOrefRequest` | Alertas OREF (Israel) |
| `/widget-agent` | `handleWidgetAgentRequest` | Agente widget (POST) |
| `/health` | — | Health público |

Nota: `getPathRateLimit` en `ais-relay.cjs:6929` asigna límites por ruta (p.ej. `RELAY_RSS_RATE_LIMIT_MAX`, `RELAY_OREF_RATE_LIMIT_MAX`).

### 2.4 Evasión y trucos anti-bloqueo (lección portable)

- OREF: `curl` en vez de Node fetch (JA3 bloqueado), proxy residencial con IP israelí, backoff 3s/6s/12s + jitter, bootstrap en 2 fases (Redis → upstream).
- Google Flights: POST al endpoint interno `/_/FlightsFrontendUi/data/...` con `f.req` codificado, cabeceras de navegador Chrome, cooldown global de 429 (120s) y negative-cache (Map con TTL 60s, max 64).
- Yahoo: peticiones espaciadas 150ms.
- Telegram: GramJS MTProto, timeout 15s por canal, ciclo de 60s, guard anti-stuck que fuerza mutex a los 3.5 min, delay de 60s al arrancar para evitar `AUTH_KEY_DUPLICATED`.
- Los tipos de cambio y mercados se piden por lotes (staggered batching).

---

## 3. Pipeline de datos y seeders

### 3.1 Contrato de seeders

Cada seeder escribe a Redis con la forma `seed-meta:<key>` para monitoring de salud. La convención general en `scripts/_seed-contract.mjs`:

- campos: `domain`, `resource`, `canonicalKey`, `fetchFn`, `validateFn`, `declareRecords`, `ttlSeconds`, `sourceVersion`, `schemaVersion`, `maxStaleMin`.

### 3.2 Inventario de seeders (~150 ficheros `scripts/seed-*.mjs`)

Familias principales:

- **Macro/economía**: `seed-bls-series`, `seed-bis-*`, `seed-imf-*`, `seed-eurostat-*`, `seed-wb-indicators`, `seed-ecb-*`, `seed-economy`, `seed-consumer-prices`, `seed-bigmac`, `seed-grocery-basket`.
- **Mercados**: `seed-market-quotes`, `seed-commodity-quotes`, `seed-crypto-quotes`, `seed-gulf-quotes`, `seed-fx-rates`, `seed-fx-yoy`, `seed-cbr-rates`, `seed-fear-greed`, `seed-cot`, `seed-etf-flows`, `seed-gold-etf-flows`, `seed-stablecoin-markets`, `seed-hyperliquid-flow`, `seed-prediction-markets`, `seed-forecast-*`.
- **Energía**: `seed-energy-*`, `seed-eia-petroleum`, `seed-jodi-oil/gas`, `seed-gie-gas-storage`, `seed-gas-storage-countries`, `seed-electricity-prices`, `seed-ember-electricity`, `seed-fossil-electricity-share`, `seed-owid-energy-mix`, `seed-power-reliability`, `seed-hormuz`, `seed-chokepoint-*`, `seed-storage-facilities`, `seed-fuel-*`.
- **Conflictos/seguridad**: `seed-ucdp-events`, `seed-unrest-events`, `seed-military-bases`, `seed-military-flights`, `seed-military-cii`, `seed-cyber-threats`, `seed-sanctions-pressure`, `seed-iran-events`, `seed-cross-strait-activity`, `seed-regulatory-actions`.
- **Natural/clima**: `seed-earthquakes`, `seed-climate-*`, `seed-fire-detections`, `seed-disease-outbreaks`, `seed-weather-alerts`, `seed-internet-outages`, `seed-radiation-watch`.
- **Infraestructura**: `seed-infra`, `seed-submarine-cables`, `seed-pipelines-*`, `seed-portwatch*`, `seed-supply-chain-trade`, `seed-trade-flows`.
- **China** (contratos fuente-específicos): `seed-china-macro`, `seed-china-policy-events`, `seed-china-corporate-disclosures`, `seed-china-decision-signals`, `seed-china-stock-connect`, `seed-china-release-calendar`, `seed-china-coverage-health`, `seed-china-decision-signals`, `seed-china-decision-signals`.
- **Noticias/insights**: `seed-insights`, `seed-digest-notifications`, `seed-news`, `seed-gdelt-*`, `seed-regional-briefs`, `seed-regional-snapshots`, `seed-research`, `seed-sec-8k-stream`.
- **Backups**: `seed-bundle-*` (macro, energy, regional, market, resilience, relay-backup, static-ref, etc).

### 3.3 Ejemplos de pipeline documentados (`docs/data-sources.mdx`)

- **Security Advisories** (`seed-security-advisories.mjs`): 24 feeds RSS/Atom (State Dept, DFAT, FCDO, 13 embajadas, CDC/ECDC/WHO) → dedupe por título → mapa `byCountry` → Redis. Vercel `ListSecurityAdvisories` lee solo Redis. Niveles: Do-Not-Travel(4) → Info(0). Extracción de países con mapa de 265 entradas.
- **OREF** (Israel): polling 5 min, wave detection por timestamps, 1.480 traducciones hebreo→inglés auto-generadas, `sanitizeHebrew()` para quitar caracteres de control bidireccional.
- **GPS jamming** (gpsjam.org): hexágonos H3 res-4, clasificación por % de aeronaves con anomalía (<2% low, 2-10% medium, >10% high), etiquetado a 12 regiones de conflicto.
- **Protestas dual-source**: ACLED (30 días, token) + GDELT (7 días), Haversine-dedup en rejilla 0.1°, scoring regime-aware (democracias logarítmico, autocráticas lineal), boost por fatalidades y apagones de internet.
- **Desastres**: USGS (M4.5+, 5 min) + GDACS + NASA EONET, dedupe en rejilla 0.1°, filtros (EONET solo 48h, excluye terremotos porque USGS es mejor).
- **Cyber**: 6 feeds (Feodo, URLhaus, C2IntelFeeds, AlienVault OTX, AbuseIPDB, Ransomware.live), geo-enrich ipinfo.io (fallback freeipapi.com), 16 lookups paralelos con timeout 12s, cap de 250 IPs/run, caché 24h, ventana 14 días, cap 500 IOCs en mapa.
- **Aviation**: 115 aeropuertos, 3 fuentes (FAA ASWS, AviationStack, ICAO NOTAM); severidad por umbrales; detección de cierre NOTAM por Q-code + regex; simulación probabilística de delays cuando no hay API key.

### 3.4 Caché y tiers (fuente: `AGENTS.md`)

- Redis (Upstash) vía `server/_shared/redis.ts`.
- `cachedFetchJson()` coalesce misses.
- Tiers: fast (5m), medium (10m), slow (30m), static (2h), daily (24h).
- La cache key debe incluir los params de la request.
- **Bootstrap tiers**: `api/bootstrap.js` hidrata los datos; keys on-demand en `ON_DEMAND_KEY_NAMES` para paneles opt-in (p.ej. `fxYoy`, `sharedFxRates`). Con `CONCEPTS.md`: "cache what we show, not the source", canonical vs view keys. Fuente: `api/bootstrap.js` + `api/_bootstrap-tier-keys.js`.

---

## 4. Capa AI / ML

### 4.1 Modelos ONNX en el navegador (`src/config/ml-config.ts`)

| id | Modelo HuggingFace | Tamaño | Prioridad | Obligatorio | Task |
|---|---|---|---|---|---|
| `embeddings` | `Xenova/all-MiniLM-L6-v2` | 23M | 1 | sí | feature-extraction |
| `sentiment` | `Xenova/distilbert-base-uncased-finetuned-sst-2-english` | 65M | 2 | no | text-classification |
| `summarization` | `Xenova/flan-t5-base` | 250M | 3 | no | text2text-generation |
| `summarization-beta` | `Xenova/flan-t5-small` | 60M | 3 | no | text2text-generation |
| `ner` | `Xenova/bert-base-NER` | 65M | 4 | no | token-classification |

- Ejecución en **Web Worker** (`src/workers/ml.worker.ts`) con RPC tipado vía `src/services/ml-worker.ts`, usando `@xenova/transformers` (ONNX en navegador, wasm/WebGPU).
- `env.allowLocalModels = false; env.useBrowserCache = true` (los modelos se descargan de HuggingFace CDN).
- Umbrales: `semanticClusterThreshold: 0.75`, `minClustersForML: 5`, `maxTextsPerBatch: 20`, `modelLoadTimeoutMs: 600_000`, `inferenceTimeoutMs: 120_000`, `memoryBudgetMB: 200`.
- Feature flags: semanticClustering, mlSentiment, summarization, mlNER, insightsPanel.

### 4.2 Otros workers

- `src/workers/analysis.worker.ts` — análisis en worker dedicado.
- `src/workers/vector-db.ts` — base vectorial (embeddings).
- `src/workers/load-dedupe.ts` — dedupe de cargas.

### 4.3 Módulos `shared/` de algoritmos (patrón definitorio, issue #5697)

Todos los algoritmos compartidos cliente/servidor viven en `shared/` como **ESM sin dependencias** → mismo resultado en browser, RPC y Railway. Ejemplos:

- `keyword-spike-core.ts` (y `.d.ts`/`.js` compilados) — detección de picos de keywords.
- `news-clustering-core.ts` — clustering de noticias.
- `entity-extraction-core.ts` — extracción de entidades.
- `text-analysis-core.ts` — análisis de texto.
- `ticker-extract.ts` — extracción de tickers de mercado.
- `ephemeral-live-classifier.ts` — clasificador live.
- `story-identity.ts` — identidad de historias (dedupe cross-source).
- `source-provenance.ts`, `source-attribution-manifest.json`, `source-geography.json` — atribución y procedencia.
- `analysis-*.ts` — módulos de análisis compuesto: `analysis-alert-digest`, `analysis-focal-points`, `analysis-geo-convergence`, `analysis-hotspot-escalation`, `analysis-infrastructure-cascade`, `analysis-military-surge`, `analysis-population-exposure`, `analysis-temporal-severity`, `analysis-composite-adapters`, `analysis-mcp-adapters`.
- `cii-*.ts` — `cii-weights`, `cii-climate-zones` (Country Instability Index).
- `china-*` — `china-activity-nowcast`, `china-decision-signals`, `china-corridor-control-towers`, `china-logistics-corridors`, `china-macro-normalization`.
- `brief-*.ts` — envelope, filtros, `brief-llm-core`.
- `decision-signal-provenance*.ts` — procedencia de señales.
- `forecast-macro-regions.ts`, `geo-data.ts`, `geo-distance.ts`, `country-bboxes`, `iso2-iso3`, `regions`.

### 4.4 LLM server-side

- Helpers LLM en `server/_shared/` (llm helpers). `brief-llm-core` en `shared/`. Docs: `docs/ai-intelligence.mdx`.

### 4.5 Country Instability Index (CII)

- `server/` + `scripts/seed-military-cii.mjs` / `seed-conflict-intel.mjs`.
- Componentes (fuente `docs/country-instability-index.mdx` y `shared/cii-weights.ts`): conflicto (UCDP+ACLED), seguridad (advisories), cyber, protestas (regime-aware), desplazamiento, clima, apagones.
- Boosts documentados en `docs/data-sources.mdx`: OREF +50 (25 + min(25, alertCount×5)), GPS jamming +35 (min(35, high×5 + medium×2)), advisories Do-Not-Travel +15 y floor 60.
- Fallback de advisories versioneado (AF, MM, SY, UA, YE, CU, IL, IQ, IR, LB, MX, PK, VE, RU, TR). Cada `CiiScore` expone `advisoryLevel` y `advisoryProvenance` (`live`|`fallback`|`absent`).
- UCDP: anual lanza ~7 meses; los seeders descubren el release mensual **GED Candidate** (`YY.0.M`) y lo fusionan sobre la base anual. Si falla, `seed-meta:conflict:ucdp-events` lleva `candidateVersion: null`.

---

## 5. Frontend — construcción

### 5.1 Componentes sin framework (pero Preact disponible)

- `src/components/`: **186 ficheros TS** top-level (en realidad componentes de clase propios, no JSX Preact mayoritariamente).
- `src/services/`: **229 módulos** (business logic).
- Dependencias estrictas: `types → config → services → components → app → App.ts`.
- `src/App.ts` es la entrada; `src/app/` orquesta: `data-loader.ts`, `refresh-scheduler.ts`, `panel-layout.ts`, `index.ts`, `event-handlers.ts`, `app-context.ts`, `lazy-services.ts`, `panel-mount-deferral.ts`, `hydration-scheduler.ts`, `news-loader-sequencing.ts`, `pending-panel-data.ts`.

### 5.2 `Panel.ts` — base de todos los paneles (53KB, 1468 líneas)

- `setSafeContent`/`setSafeHtml` con **debounce y dirty-check** (`lastCommittedHtml`).
- `replaceContent` con `replaceChildren` (evita re-flash).
- Drag-resize con `ROW_RESIZE_STEP_PX = 80`, persistencia de spans (clases `span-1..4`, `col-span-*`).
- Severidad: `critical | high | medium | low | none`.
- Gating premium: `panel-locked-state` + CTA a Pro.

### 5.3 Mapas (`src/components/DeckGLMap.ts`, `GlobeMap.ts`)

- Dos motores unificados: **deck.gl** (PMTiles) y **globe.gl** (3D).
- Supercluster para agrupación.
- `src/config/map-layer-definitions.ts`: ~56 tipos de capa (ScatterplotLayer, GeoJsonLayer, PathLayer, IconLayer, PolygonLayer, ArcLayer, HeatmapLayer, H3HexagonLayer).
- `src/config/basemap.ts` + `basemap-styles.ts` para estilos de base.
- `docs/map-engine.mdx` para el detalle.

### 5.4 Variantes (`src/config/variants/`)

Ficheros: `base.ts`, `full.ts`, `tech.ts`, `finance.ts`, `commodity.ts`, `energy.ts`, `happy.ts`. Vía `VITE_VARIANT`.

Cada variante difiere en: paneles, layers del mapa, feeds RSS, intervalos de polling, tema. `npm run dev:tech` / `dev:energy` para variantes.

Ejemplos de feeds por variante en `docs/data-sources.mdx` (líneas 405-469): categorías `politics`, `us`, `europe` (una lista enorme de medios), `middleeast`, `tech`, `ai`, `finance`, `commodities`, `gov`, `africa`, `latam`, `asia`, `energy`, `thinktanks`, `crisis`, `layoffs`, `intel` (fuentes OSINT). El `full` añade `INTEL_SOURCES`.

### 5.5 Carga de datos (`src/app/data-loader.ts`)

- `loadAllData(forceAll)` con **cola de rerun** (`loadAllDataRerunRequested`, `loadAllDataQueuedForceAll`).
- `startSmartPollLoop()`: backoff exponencial, refresh condicionado al viewport, pausa por tab oculta, `primeVisiblePanelData()`.
- `refresh-scheduler.ts` para los ciclos por panel.
- Circuit breakers por dominio (`src/utils/circuit-breaker.ts`).

### 5.6 i18n y estado

- `src/locales/`: 26 idiomas con soporte RTL.
- Estado vía CustomEvents y localStorage (watchlist de aviación `aviation:watchlist:v1`, watchlist de mercados, layout de paneles).
- `src/config/panels.ts` registra los paneles.

### 5.7 UX / situational awareness

- `SignalModal.ts`, `IntelligenceGapBadge.ts`, `BreakingNewsBanner.ts`, ticker de noticias.
- `BreakingNewsAlerts` service en `src/services/breaking-news-alerts.ts`.
- Webcams YouTube (22 streams, lazy via IntersectionObserver, pause a los 5 min, destroy en tab oculta).
- Datos estáticos embebidos en `src/data/` y `data/` (telegram channels, irradiadores gamma, traducciones OREF).

---

## 6. API pública (`api/`, 146 ficheros)

Estructura por dominios: `aviation/`, `cyber/`, `data/`, `discord/`, `displacement/`, `economic/`, `forecast/`, `geo.js`, `health/`, `imagery/`, `infrastructure/`, `intelligence/`, `internal/`, `maritime/`, `market/`, `mcp/`, `military/`, `natural/`, `news/`, `positive-events/`, `prediction/`, `radiation/`, `research/`, `resilience/`, `sanctions/`, `scenario/`, `security/`, `seismology/`, `supply-chain/`, `thermal/`, `trade/`, `unrest/`, `user/`, `webcam/`, `wildfire/`, `youtube/`.

Helpers compartidos `api/_*.js`: `_relay.js`, `_api-key.js`, `_cors.js`, `_crypto.js`, `_rate-limit.js`, `_session.js`, `_sentry-*.js`, `_json-response.js`, `_client-ip.js`, `_content-freshness.js`, `_seed-envelope.js`, `_upstash-json.js`, `_usage-telemetry.js`, `_bootstrap-*.js`.

Endpoints singulares: `bootstrap.js` (hidratación masiva), `health.js` (con `STANDALONE_KEYS`), `ask.ts` (chat), `chat-analyst.ts`, `story.js` (OG stories), `latest-brief.ts`, `wm-session.js`, `opensky.js`, `oref-alerts.js`, `polymarket.js`, `rss-proxy.js`, `telegram-feed.js`, `notify.ts`, `download.js`.

---

## 7. Patrones portables a `real_time_world_data_dashboard`

1. **Arquitectura relay + Redis**: un solo servicio con credenciales hace fetch upstream; el edge/navegador solo lee caché. Evita exponer secrets y sortea CORS/rate-limits.
2. **`cachedFetchJson` con stampede protection** (coalesce concurrent misses).
3. **Contrato de seeders** (`seed-meta:<key>`, `sourceVersion`, `schemaVersion`, `maxStaleMin`) → health checks de frescura por fuente.
4. **Algoritmos compartidos en `shared/` sin dependencias** → misma lógica en browser, RPC y server (patrón issue #5697).
5. **Web Worker ML con RPC tipado** para embeddings/sentiment/NER/summarization ONNX en navegador.
6. **CII con scoring componible** (componentes por dominio + pesos + floors/boosts + procedencia de cada señal).
7. **Bootstrap tiers** (fast/slow/on-demand) con canonical vs view keys.
8. **Dirty-check y debounce en render de paneles** (`lastCommittedHtml`, `replaceChildren`).
9. **Smart poll loop**: backoff, pausa en tab oculta, refresh por viewport.
10. **Variantes** de app completas desde config (paneles/layers/feeds/tema) vía env var.
11. **Evasión anti-bloqueo**: curl para JA3, proxies residenciales, stagger de peticiones, negative-cache de 429.
12. **Frescura visible**: badges de staleness, health por fuente, "degradado no cero" para fuentes caídas.

---

## 8. Referencias de archivos clave

| Área | Ruta |
|---|---|
| Visión/arquitectura | `ARCHITECTURE.md`, `README.md`, `docs/architecture.mdx` |
| Glosario de dominio | `CONCEPTS.md` |
| Reglas del repo | `AGENTS.md` |
| Catálogo de fuentes | `docs/data-sources.mdx` (1309 líneas) |
| Relay | `scripts/ais-relay.cjs` (12.688 líneas) |
| Config ML | `src/config/ml-config.ts` |
| Worker ML | `src/workers/ml.worker.ts`, `src/services/ml-worker.ts` |
| Algoritmos compartidos | `shared/` |
| Base de paneles | `src/components/Panel.ts` |
| Mapas | `src/components/DeckGLMap.ts`, `GlobeMap.ts`, `src/config/map-layer-definitions.ts` |
| Variantes | `src/config/variant.ts`, `src/config/variants/` |
| Layout | `src/app/panel-layout.ts` |
| Carga de datos | `src/app/data-loader.ts`, `refresh-scheduler.ts` |
| Bootstrap tiers | `api/bootstrap.js`, `api/_bootstrap-tier-keys.js` |
| Caché/stampede | `server/_shared/redis.ts`, `server/_shared/relay.ts` |
| Edge helpers | `api/_*.js` |
| Docs API | `docs/api/`, `docs/openapi/`, `docs/mcp-*.mdx` |
