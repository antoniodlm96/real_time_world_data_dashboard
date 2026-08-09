# real_time_world_data_dashboard
Real Time World Data Dashboard is a live observatory that unifies armed conflicts, natural disasters, cyberattacks, and financial markets on one interactive world map. It combines open sources (USGS, GDELT, CoinGecko, Open-Meteo, OpenSky, RSS news) in a control-room interface, with visual alerts and a live headline ticker.

## Deploy with Docker

```bash
cp .env.example .env      # define POSTGRES_PASSWORD (obligatoria) y las API keys
docker compose up --build -d
```

Stack: Postgres (persistence) + Redis (cache) + FastAPI backend + React frontend served by nginx under `/dashboard/`.

- Dashboard (producción vía Tailscale): **https://myserver.tail6b3a21.ts.net/dashboard/**
- Health check: `curl http://localhost:8000/api/health` → `{"status":"ok"}`

See [`DOCKER.md`](DOCKER.md) for the full deployment guide and [`ARCHITECTURE.md`](ARCHITECTURE.md) for the current infrastructure.

## Auto-deploy (myserver)

Pushing to `main` auto-deploys to `myserver` via a **self-hosted GitHub Actions runner**: the workflow does `git fetch && git reset --hard origin/main && docker compose up --build -d` in `/home/user/apps/real_time_world_data_dashboard`. External access is through Tailscale (`tailscale serve`), which maps `/dashboard` → the frontend on `127.0.0.1:3000`. See [`DOCKER.md`](DOCKER.md) → *Despliegue en producción*.

## Development

```bash
cd backend && DASHBOARD_DB_TYPE=sqlite python3 -m uvicorn backend.app.main:app --reload --port 8000
cd frontend && npm install && npm run dev   # → http://localhost:5173
```
