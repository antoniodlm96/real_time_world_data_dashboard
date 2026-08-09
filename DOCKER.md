# DOCKER.md — Despliegue con Docker

Guía completa del entorno contenedorizado del **Real Time World Data Dashboard**: qué contiene, cómo instalarlo, cómo arrancarlo y cómo se despliega en producción.

---

## 1. Qué contiene el despliegue

`docker-compose.yml` orquesta **4 servicios**. A diferencia del desarrollo local (SQLite), el despliegue en Docker usa **PostgreSQL** como base de datos persistente y **Redis** como caché.

```
                          Cliente (navegador)
                                 │  https://myserver.tail6b3a21.ts.net/dashboard/
                                 ▼  (Tailscale HTTPS — elimina el prefijo /dashboard)
                                            ┌────────────────────────────┐
                                            │  frontend (nginx :3000)    │
                                            │  /          → estáticos    │
                                            │  /api/*     → proxy backend │
                                            │  /dashboard/api/* → backend│
                                            └──────────────┬─────────────┘
                                                           │ /api
                                            ┌──────────────▼─────────────┐
                                            │  backend (FastAPI :8000)   │  ingestion loop (cada 10s)
                                            └───────┬─────────────┬──────┘
                                        DASHBOARD_DATABASE_URL    DASHBOARD_REDIS_URL
                                            ┌────────▼─────┐  ┌──▼────┐
                                            │ postgres:16  │  │ redis │
                                            │   (:5432)    │  │(:6379)│
                                            └──────────────┘  └───────┘
```

### Servicios

| Servicio | Imagen | Puerto host | Descripción |
|----------|--------|-------------|-------------|
| `postgres` | `postgres:16-alpine` | *(solo red interna)* | Base de datos principal (datos persistentes) |
| `redis` | `redis:7-alpine` | *(solo red interna)* | Caché en memoria de las APIs externas |
| `backend` | build `./backend` | `127.0.0.1:8000` | API FastAPI + loop de ingestión en segundo plano |
| `frontend` | build `./frontend` | `127.0.0.1:3000` | Build estático de React servido por nginx (proxya `/api` al backend) |

> Los puertos de `postgres` (5432) y `redis` (6379) **no se publican en el host**: solo son accesibles dentro de la red Docker. Los puertos `3000` y `8000` solo escuchan en `127.0.0.1` (no en `0.0.0.0`). El acceso externo pasa siempre por **Tailscale** (`tailscale serve`), que enruta `/dashboard` → `127.0.0.1:3000` y el dominio raíz → `127.0.0.1:8080` (Homepage).

### Campos clave del `docker-compose.yml`

- **`postgres`** crea automáticamente el usuario/BD `dashboard`, con la contraseña **`POSTGRES_PASSWORD`** leída del `.env` (obligatoria; el compose falla si no está definida). Expone un healthcheck con `pg_isready`.
- **`redis`** incluye healthcheck con `redis-cli ping`.
- **`backend`** arranca solo cuando `postgres` y `redis` están sanos (`service_healthy`). Recibe `DASHBOARD_DB_TYPE=postgres` y `DASHBOARD_DATABASE_URL` apuntando al contenedor `postgres`, no a `localhost`. Carga variables extra desde `.env` opcionalmente (`env_file.required: false`).
- **`frontend`** se construye en dos etapas (build de Node 24 → imagen final nginx), copia `nginx.conf` y añade **labels de Homepage** (`homelab.*`) para que aparezca en el launcher bajo `/dashboard/`.
- Volúmenes nombrados: `pg_data` (PostgreSQL) y `redis_data` (Redis). Sobreviven a `docker compose down`.

### archivo `frontend/nginx.conf`

El build de Vite usa `base: '/dashboard/'`, de modo que los assets se referencian como `/dashboard/assets/...`. Sin embargo, **Tailscale elimina el prefijo `/dashboard`** antes de proxyar a `:3000`, así que nginx sirve los estáticos desde la **raíz** (`/usr/share/nginx/html`) y mantiene ambos enrutados de API:

```nginx
location /dashboard/api/ { proxy_pass http://backend:8000/api/; ... }
location /api/           { proxy_pass http://backend:8000; ... }
location /dashboard/     { try_files $uri $uri/ /dashboard/index.html; }
location /               { try_files $uri $uri/ /index.html; }
```

El frontend deriva la base de la API de `import.meta.env.BASE_URL` (`/dashboard/api`) en `frontend/src/api.ts`, usado por todos los hooks (ver `ARCHITECTURE.md` → *Frontend*).

---

## 2. Requisitos previos

- **Docker Engine** ≥ 24 (o Docker Desktop en macOS/Windows).
- **Docker Compose v2** (sintaxis `docker compose`, no `docker-compose`). El bloque `env_file: { required: false }` necesita Compose **v2.24+**.
- `POSTGRES_PASSWORD` definido en el `.env` (el compose lo exige vía `${POSTGRES_PASSWORD:?…}`).
- Puertos libres en el host: `3000`, `8000`. `5432`/`6379` quedan internos solo a la red Docker.
- Recomendado: ~2 GB de RAM libres para el stack completo.

Comprueba tu instalación:

```bash
docker --version
docker compose version
```

---

## 3. Instalación y arranque

### 1) Clona el repositorio (si no lo tienes)

```bash
git clone <url_del_repositorio>
cd real_time_world_data_dashboard
```

### 2) Configura tu `.env` (obligatoria POSTGRES_PASSWORD; opcional las claves)

Crea el fichero `.env` en la raíz (ya está en `.gitignore`, no se sube al repo). Parte de la plantilla `.env.example`:

```bash
cp .env.example .env   # o crea .env a mano con:
```

```env
POSTGRES_PASSWORD=una_password_segura
DASHBOARD_GROQ_API_KEY=tu_clave_de_groq
DASHBOARD_FIRMS_API_KEY=tu_clave_de_nasa_firms
```

- **`POSTGRES_PASSWORD`** es **obligatoria**: la usa PostgreSQL para crear el usuario `dashboard` y también la URL `DASHBOARD_DATABASE_URL` del backend. Sin ella, `docker compose up` aborta con error.
- **Groq** activa la clasificación/por traducción automática de noticias y la generación de eventos del mapa.
- **NASA FIRMS** activa el nivel de incendios en el mapa.
- **Sin las claves de API**: el backend arranca igualmente, solo se desactivan esos extras (el bloque `required: false` lo permite).

> Ojo: el `./backend/app/config.py` prefiere `DASHBOARD_` como prefijo para toda variable de entorno y define `extra: "ignore"`, de modo que variables sin ese prefijo (como `POSTGRES_PASSWORD`) se ignoran sin fallar.

### 3) Construye y levanta

```bash
docker compose up --build
```

En segundo plano:

```bash
docker compose up --build -d
```

La primera vez **descarga imágenes y compila** (backend: pip install; frontend: `npm ci` + Vite build); puede tardar varios minutos. Al final:

- El backend ejecuta `init_db()` automáticamente (crea tablas y datos semilla).
- `postgres` y `redis` arrancan primero (healthchecks) y solo entonces el backend.

---

## 4. Verificación

```bash
# Estado de los contenedores
docker compose ps

# Salud de la API
curl http://localhost:8000/api/health
# → {"status":"ok"}

# Estado con métricas de BD (debe mostrar "type": "postgres")
curl http://localhost:8000/api/status
```

Abre el dashboard en el navegador:

- Despliegue detrás de Tailscale: **https://myserver.tail6b3a21.ts.net/dashboard/**
- Directo en la máquina: **http://localhost:3000/dashboard/**

---

## 5. URLs de acceso

En producción (myserver) el tráfico entra por **Tailscale HTTPS** (`tailscale serve`), que reescribe las rutas:

| Servicio | URL |
|----------|-----|
| Dashboard (frontend) | `https://myserver.tail6b3a21.ts.net/dashboard/` |
| Homepage (launcher) | `https://myserver.tail6b3a21.ts.net/` |
| API backend (host, local) | `http://localhost:8000` |
| Frontend (host, local) | `http://localhost:3000/dashboard/` |
| Swagger UI (docs de la API) | `http://localhost:8000/docs` |
| PostgreSQL | Solo red Docker (`postgres:5432`) · `dashboard` / `POSTGRES_PASSWORD` |
| Redis | Solo red Docker (`redis:6379`) |

### Endpoints principales de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Salud |
| GET | `/api/status` | Estado global (tablas, procesos, fuentes) |
| GET | `/api/status/logs` | Logs recientes |
| GET | `/api/events/disasters` | Terremotos/desastres activos |
| GET | `/api/events/conflicts` | Conflictos |
| GET | `/api/events/cyber` | Ciberataques |
| GET | `/api/markets/crypto` | Criptomonedas |
| GET | `/api/markets/forex` | Divisas |
| GET | `/api/markets/commodities` | Materias primas |
| GET | `/api/news` · `/api/news/countries` | Noticias y países |
| GET | `/api/fires` | Incendios |
| GET | `/api/flights` | Vuelos |
| GET | `/api/weather` | Clima mundial |
| GET | `/api/webcams` · `/api/webcams/countries` | Webcams y países |
| POST | `/api/webcams` | Añadir webcam |
| PATCH | `/api/webcams/{id}/deactivate` | Desactivar webcam |
| GET | `/api/radio` · `/api/radio/countries` | Emisoras de radio |

> En el frontend desplegado tras Tailscale, todos los endpoints se sirven bajo `/dashboard/api/…` (p. ej. `https://myserver.tail6b3a21.ts.net/dashboard/api/status`).

---

## 6. Configuración (variables de entorno)

Todas con prefijo `DASHBOARD_` (condiciones en `backend/app/config.py`; `extra: "ignore"` deja pasar las demás).

| Variable | Por defecto (Docker) | Uso |
|----------|----------------------|-----|
| `DASHBOARD_DB_TYPE` | `postgres` | Motor de BD (`postgres` o `sqlite`) |
| `POSTGRES_PASSWORD` | *(del `.env`, obligatoria)* | Contraseña de PostgreSQL (usuario `dashboard` y URL del backend) |
| `DASHBOARD_DATABASE_URL` | construida con `POSTGRES_PASSWORD` | Conexión a PostgreSQL |
| `DASHBOARD_REDIS_URL` | `redis://redis:6379/0` | Conexión a Redis |
| `DASHBOARD_CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Orígenes permitidos en CORS |
| `DASHBOARD_GROQ_API_KEY` | *(del `.env`)* | Clasificación de noticias (Groq) |
| `DASHBOARD_FIRMS_API_KEY` | *(del `.env`)* | Incendios (NASA FIRMS) |
| `DASHBOARD_DB_PATH` | `data/dashboard.db` | Sólo si `DB_TYPE=sqlite` |
| `DASHBOARD_API_PREFIX` | `/api` | Prefijo de los endpoints |
| `DASHBOARD_CACHE_TTL_EARTHQUAKE` | `300` | Caché de terremotos (s) |
| `DASHBOARD_CACHE_TTL_GDELT` | `900` | Caché de noticias (s) |
| `DASHBOARD_CACHE_TTL_CRYPTO` | `60` | Caché de criptomonedas (s) |
| `DASHBOARD_CACHE_TTL_FOREX` | `43200` | Caché de divisas (s) |
| `DASHBOARD_CACHE_TTL_WEATHER` | `900` | Caché de clima (s) |

Para invalidar en tiempo de ejecución (sin editar el compose):

```bash
DASHBOARD_GROQ_API_KEY=... docker compose up -d
```

---

## 7. Datos persistentes

- **PostgreSQL** guarda los datos en el volumen `pg_data` → montado en `/var/lib/postgresql/data` del contenedor.
- **Redis** guarda su dump en `redis_data` → `/data`.

Los datos **no se pierden** con `docker compose stop` ni `down`. Para asegurarlos, escribe las claves con:

```bash
docker run --rm -v pg_data -v ... # (ver copias de seguridad abajo)
```

---

## 8. Copia de seguridad de la base de datos

Usa la contraseña del `.env` (`POSTGRES_PASSWORD`):

```bash
# Volcado (backup)
docker compose exec postgres pg_dump "postgresql://dashboard:${POSTGRES_PASSWORD}@localhost:5432/dashboard" > backup.sql

# Restauración (borra y recrea)
docker compose exec -T postgres psql "postgresql://dashboard:${POSTGRES_PASSWORD}@localhost:5432/dashboard" < backup.sql
docker compose exec -T postgres psql "postgresql://dashboard:${POSTGRES_PASSWORD}@localhost:5432/dashboard" -c "SELECT count(*) FROM events;"
```

> `POSTGRES_PASSWORD` se inyecta desde el `.env` si usas `set -a && . ./.env` antes, o define la variable explícitamente.

---

## 9. Comandos útiles

```bash
# Ver estado y procesos
docker compose ps

# Logs en directo (todo / de un servicio)
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend

# Detener (mantiene contenedores y volumenes)
docker compose stop

# Parar y eliminar contenedores (conserva datos)
docker compose down

# Parar, eliminar contenedores Y borrar datos (PostgreSQL + Redis)
docker compose down -v

# Recompilar tras cambios en el código
docker compose up --build -d

# Reiniciar un servicio
docker compose restart backend
```

---

## 10. Flujo de datos internos

- El SPA (React) consulta `/dashboard/api/*` → nginx reescribe a `/api/*` → backend (FastAPI :8000).
- Backend cachéa respuestas externas en Redis con TTL por fuente:

| Clave Redis | Fuente | TTL |
|--------------|--------|-----|
| `usgs:earthquakes` | USGS | 5 min |
| `coingecko:crypto_markets` | CoinGecko | 1 min |
| `frankfurter:latest` | Frankfurter (forex) | 12 h |
| `news:all_feeds` | RSS noticias | 15 min |
| `openmeteo:all_cities` | Open-Meteo (clima) | 15 min |

- El backend inicia una **tarea de ingestión** (`ingest.py`) que cada ~10 s consulta USGS, CoinGecko, Frankfurter, RSS de noticias, OpenSky, Open-Meteo, etc., y hace **upserts** en PostgreSQL.
- En el arranque (`lifespan`) se ejecuta `init_db()` y se siembran las webcams y frecuencias de radio base.

---

## 11. Despliegue en producción (myserver)

El despliegue en `myserver` es **automático** mediante un runner self-hosted de GitHub Actions: cualquier **push a `main`** dispara el workflow.

### `.github/workflows/deploy.yml`

```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: [self-hosted]
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Deploy with Docker Compose
        working-directory: /home/user/apps/real_time_world_data_dashboard
        run: |
          git fetch origin
          git reset --hard origin/main
          docker compose up --build -d
```

### Configuración del servidor

- El runner corre como `user` y clona el repo en `/home/user/apps/real_time_world_data_dashboard`.
- Ese directorio de trabajo tiene su propio `.env` (con `POSTGRES_PASSWORD`, `DASHBOARD_GROQ_API_KEY`, `DASHBOARD_FIRMS_API_KEY`), que **no** se toca en cada deploy (el `git reset --hard` no lo borra porque `.env` está en `.gitignore`).
- `POSTGRES_PASSWORD` del `.env` se usa para interpolar el compose (`${POSTGRES_PASSWORD:?…}`). Si la cambias, además debes actualizar la contraseña del rol en PostgreSQL (`ALTER USER dashboard WITH PASSWORD '…'`).
- Acceso externo: **Tailscale** enruta el dominio `myserver.tail6b3a21.ts.net` vía `tailscale serve`:

```
https://myserver.tail6b3a21.ts.net/                → 127.0.0.1:8080  (Homepage)
https://myserver.tail6b3a21.ts.net/dashboard       → 127.0.0.1:3000  (frontend, reescribe /dashboard → /)
https://myserver.tail6b3a21.ts.net:9443            → 127.0.0.1:9000  (Portainer)
```

### Desplegar manualmente

```bash
cd /home/user/apps/real_time_world_data_dashboard
git fetch origin && git reset --hard origin/main
docker compose up --build -d
```

---

## 12. Solución de problemas

| Problema | Causa / Solución |
|----------|------------------|
| `port is already allocated` | Puertos `3000/5432/6379/8000` ocupados. Libera o cambia el mapeo de puertos en el compose. |
| El frontend no carga datos del mapa | Confirma que `/api/*` se proxiéa: `curl http://localhost:3000/api/health`. Si falla, revisa el `nginx.conf` del frontend. El SPA usa `BASE_URL/api` (`/dashboard/api` en producción). |
| En producción aparece "Welcome to nginx" | Tailscale reescribe `/dashboard` → `/`; el dist debe estar en la **raíz** de nginx (`/usr/share/nginx/html`), no bajo `html/dashboard/`. `docker compose up --build -d`. |
| API de clima da 429 de Open-Meteo | Se agotó la cuota diaria gratuita (10k req). Se cachéa con TTL de 15 min (`openmeteo:all_cities`); espera al reseteo (medianoche UTC). |
| El backend no arranca | Revisa el healthcheck de BD: `docker compose logs postgres`. Espera a que `pg_isready` devuelva OK. |
| La clasificación de noticias no funciona | Revisa que `.env` tenga `DASHBOARD_GROQ_API_KEY` y que el container lo vea: `docker compose exec backend env \| grep GROQ` |
| Base de datos corrupta / tasa | Borra solo el volumen de datos: `docker compose down -v && docker compose up -d` |
| Cambios en el código que no se reflejan | Reconstruye las imágenes con `docker compose up --build -d`, o haz un push a `main` para desplegar. |

---

## 13. Alternativas: ejecutar sin Docker (desarrollo)

Sin Docker puedes correr el stack con **SQLite** (sin PostgreSQL); la caché de Redis solo se activa si `REDIS_URL` apunta a un Redis accesible (si no, cada ciclo consulta las APIs directamente):

```bash
# Terminal 1 — backend (usa SQLite en data/dashboard.db)
DASHBOARD_DB_TYPE=sqlite python3 -m uvicorn backend.app.main:app --reload --port 8000

# Terminal 2 — frontend (Vite con proxy a :8000)
cd frontend && npm install && npm run dev
```

Acceso: **http://localhost:5173**

Para usar PostgreSQL local sin Docker, exporta `DASHBOARD_DATABASE_URL` apuntando a tu instancia (`postgresql://user:pass@localhost:5432/dashboard`) y deja `DASHBOARD_DB_TYPE=postgres`.