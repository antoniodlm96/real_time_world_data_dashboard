# real_time_world_data_dashboard
Real Time World Data Dashboard is a live observatory that unifies armed conflicts, natural disasters, cyberattacks, and financial markets on one interactive world map. It combines open sources (USGS, GDELT, CoinGecko) in a control-room interface, with visual alerts and a live headline ticker.

## Deploy with Docker

```bash
cp .env.example .env      # define POSTGRES_PASSWORD (obligatoria) y las API keys
docker compose up --build -d
```

See [`DOCKER.md`](DOCKER.md) for the full deployment guide. Pushing to `main` auto-deploys to `myserver` via a self-hosted GitHub Actions runner.
