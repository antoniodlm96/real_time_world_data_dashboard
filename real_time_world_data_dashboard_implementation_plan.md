# Implementation Plan — real_time_world_data_dashboard

**Product name:** real_time_world_data_dashboard
**Description (293 characters):** Real Time World Data Dashboard is a live observatory that unifies armed conflicts, natural disasters, cyberattacks, and financial markets on one interactive world map. It combines open sources (USGS, GDELT, CoinGecko) in a control-room interface, with visual alerts and a live headline ticker.

---

## 1. Executive summary

real_time_world_data_dashboard is a web application that aggregates, geolocates, and visualizes four categories of world events in real time: armed conflicts, natural disasters, cyberattacks, and financial markets. The initial prototype (a single-file React artifact) proves the concept is viable; this document defines the path from that prototype to a robust, maintainable production product.

**Project goal:** provide, at a glance, a reliable and up-to-date picture of the state of the world by aggregating open and paid data sources into a visually compelling, easy-to-read interface.

**Estimated duration:** 10–12 weeks for a production-ready (MVP+) release.

---

## 2. Scope

### 2.1 Included in the MVP
- Interactive world map with toggleable layers (wars, disasters, cyberattacks).
- Side panels with live per-category lists.
- Financial markets panel (live crypto and forex; stock indices with an optional API key).
- Combined headline ticker.
- Automatic periodic refresh plus a manual refresh button.
- Graceful degradation mode (fallback data if a source fails).
- Responsive design (desktop and mobile).

### 2.2 Out of scope initially (future backlog)
- User accounts and saved preferences.
- Push notifications / alerts via email or Telegram.
- Historical view and event "time travel" playback.
- Public health/epidemic panel (WHO) and extreme weather.
- Native mobile app (iOS/Android).
- Multi-language UI.

---

## 3. Proposed architecture

### 3.1 Overview
```
┌────────────────────┐      ┌─────────────────────────┐      ┌───────────────────┐
│  External sources   │ ───▶ │   Aggregation backend     │ ───▶ │   Frontend (SPA)    │
│  USGS · GDELT ·      │      │  (normalizes, caches,     │      │  React + map +       │
│  CoinGecko ·          │      │   exposes its own API)    │      │  live panels          │
│  Frankfurter ·        │      │  + cache database          │      │  (WebSocket/poll)     │
│  stock data provider  │      └─────────────────────────┘      └───────────────────┘
└────────────────────┘
```

### 3.2 Why introduce a dedicated backend
The prototype queries external APIs directly from the browser. For production, a lightweight backend layer is recommended to:
- Avoid CORS and rate-limit issues from external sources.
- Hide sensitive API keys (stock data provider, if added).
- Cache results (Redis) so external APIs aren't hit on every user page load.
- Normalize the different formats (GeoJSON, plain JSON, CSV) into a single "event" schema.
- Allow new sources to be added without touching the frontend.

### 3.3 Recommended tech stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, D3 (map projection), Tailwind CSS |
| Backend | Node.js (Fastify or Express) or Python (FastAPI) |
| Cache / queue | Redis |
| Database (optional history) | PostgreSQL + PostGIS (geospatial data) |
| Real time | WebSockets (Socket.IO) or Server-Sent Events; polling fallback |
| Infrastructure | Docker + deployment on Vercel/Netlify (frontend) and Render/Fly.io/AWS (backend) |
| Observability | Sentry (errors), Grafana + Prometheus or Better Stack (metrics and uptime) |
| CI/CD | GitHub Actions |

---

## 4. Data sources and integration contracts

| Category | Source | Cost | Notes |
|---|---|---|---|
| Earthquakes | USGS Earthquake GeoJSON Feed | Free, no key | CORS-enabled, high reliability |
| Conflicts / cyberattacks | GDELT Project (Geo 2.0 API) | Free, no key | No guaranteed SLA; may need retries |
| Cryptocurrencies | CoinGecko | Free (rate-limited) | Paid plan available if scaling up |
| Forex | Frankfurter (ECB) | Free, no key | Daily update, not intraday |
| Stock indices | Twelve Data / Alpha Vantage / Finnhub | Freemium | Requires an API key; provider to be finalized in phase 2 |
| Future: expanded disasters | GDACS / ReliefWeb | Free | Backlog |
| Future: epidemics | WHO | Free | Backlog |

**Pre-development action:** validate real rate limits and CORS reliability for GDELT and USGS in a test environment before committing the backend design to a specific refresh interval.

---

## 5. Phased plan and timeline

### Phase 0 — Discovery and technical validation (Week 1)
- Audit rate limits, reliability, and CORS behavior for each source.
- Choose a stock market data provider and provision an API key.
- Define a unified "event" schema (type, location, magnitude/relevance, source, timestamp).
- Deliverable: technical sources document + data schema.

### Phase 1 — Aggregation backend (Weeks 2–3)
- Build the backend service with its own endpoints: `/events/conflicts`, `/events/disasters`, `/events/cyber`, `/markets`.
- Implement Redis caching with a per-source TTL (e.g., 5 min for earthquakes, 15 min for GDELT, 1 min for crypto).
- Normalize all sources into the common schema.
- Per-source error handling with retries and fallback data.
- Deliverable: documented in-house API (OpenAPI/Swagger) deployed to a staging environment.

### Phase 2 — Production frontend (Weeks 3–5)
- Migrate the prototype (artifact) into a standalone Vite/React project.
- Connect to the in-house API instead of external sources directly.
- Implement real-time updates (WebSocket or smart polling).
- Polish the design: accessibility (contrast, keyboard focus), map performance with many markers (clustering if needed).
- Deliverable: working frontend connected to the real backend.

### Phase 3 — Markets integration and additional layers (Week 6)
- Integrate the stock index data provider.
- Add a time-range selector (24h / 7 days) for conflicts and cyberattacks.
- Deliverable: complete markets panel.

### Phase 4 — Testing and quality (Weeks 7–8)
- Backend unit tests (normalization, caching, failure handling).
- Frontend end-to-end tests (Playwright/Cypress): initial load, layer toggling, degraded mode.
- Load testing on the in-house API.
- Accessibility and performance audit (Lighthouse).
- Deliverable: test report and completed quality checklist.

### Phase 5 — Deployment and observability (Week 9)
- Set up CI/CD (build, test, auto-deploy on every merge to `main`).
- Deploy backend in a container (Render/Fly.io/AWS ECS) with basic autoscaling.
- Deploy frontend on Vercel/Netlify with a CDN.
- Configure error monitoring (Sentry) and service downtime alerts.
- Deliverable: production application on a custom domain with HTTPS.

### Phase 6 — Launch and stabilization (Weeks 10–12)
- Intensive post-launch observation period.
- Tune refresh intervals based on real usage and API limits.
- Collect feedback from early users.
- Deliverable: stable 1.0 release and a prioritized backlog for future iterations.

---

## 6. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| GDELT has no SLA / intermittent outages | Stale conflict/cyberattack data | Aggressive caching + transparent "demo" mode for the user |
| CoinGecko rate limits at scale | 429 errors | Backend-level caching, upgrade to paid plan if traffic grows |
| Cost of real-time stock market API | Monthly overspend | Start with 15-minute delayed data (free tier) |
| Visual overload on the map with many events | Poor user experience | Marker clustering and relevance-based limits |
| Misuse for disinformation | Reputational | Always cite the original source of each data point in the UI |

---

## 7. Estimated monthly costs (indicative)

| Item | Estimated cost |
|---|---|
| Backend hosting (Render/Fly.io, basic plan) | $15–25/mo |
| Frontend hosting (Vercel/Netlify) | $0–20/mo |
| Managed Redis | $0–15/mo |
| Stock market API (freemium/basic plan) | $0–50/mo |
| Monitoring (Sentry free/team) | $0–26/mo |
| **Estimated total** | **$15–135/mo** depending on service level |

---

## 8. Success metrics (KPIs)

- Service availability ≥ 99.5% monthly.
- Initial load time < 2.5s (75th percentile).
- Data freshness: 95% of requests serve data less than 5 minutes old.
- External source error rate handled without affecting perceived availability (functional degraded mode).

---

## 9. Immediate next steps

1. Confirm the stock market data provider and provision the API key.
2. Create a repository with `backend/` and `frontend/` structure.
3. Define the unified "event" schema in a shared document.
4. Set up a development environment with Docker Compose (backend + Redis).
