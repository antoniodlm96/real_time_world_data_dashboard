# DOCKER.md — Despliegue con Docker

Guía completa del entorno contenedorizado del **Real Time World Data Dashboard**: qué contiene, cómo instalarlo y cómo arrancarlo.

---

## 1. Qué contiene el despliegue

`docker-compose.yml` orquesta **4 servicios**. A diferencia del desarrollo local (SQLite), el despliegue en Docker usa **PostgreSQL** como base de datos persistente y **Redis** como caché.

```
                                            ┌────────────────────────────┐
                                            │  frontend (nginx :3000)    │
                                            │  /      → estáticos React  │
                                            │  /api/* → proxy a backend  │
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
| `postgres` | `postgres:16-alpine` | `5432` | Base de datos principal (datos persistentes) |
| `redis` | `redis:7-alpine` | `6379` | Caché en memoria de las APIs externas |
| `backend` | build `./backend` | `8000` | API FastAPI + loop de ingestión en segundo plano |
| `frontend` | build `./frontend` | `3000` | Build estático de React servido por nginx (proxya `/api` al backend) |

### Campos clave del `docker-compose.yml`

- **`postgres`** crea automáticamente el usuario/BD `dashboard` / `dashboard`, con la contraseña **`POSTGRES_PASSWORD`** leída del `.env` (obligatoria; el compose falla si no está definida). Expone un healthcheck con `pg_isready`.
- **`redis`** incluye healthcheck con `redis-cli ping`.
- **`backend`** arranca solo cuando `postgres` y `redis` están sanos (`service_healthy`). Recibe las variables `DASHBOARD_DB_TYPE=postgres` y `DASHBOARD_DATABASE_URL` apuntando al contenedor `postgres`, no a `localhost`.
- **`frontend`** se construye en dos etapas (build de Node 24 → imagen final nginx) y copia `nginx.conf`, que enruta `/api/*` hacia `backend:8000`.
- Volúmenes nombrados: `pg_data` (PostgreSQL) y `redis_data` (Redis). Sobreviven a `docker compose down`.

### archivo `frontend/nginx.conf`

Necesario porque el frontend hace peticiones **relativas** a `/api/`. En desarrollo lo resuelve el proxy de Vite; en producción lo resuelve nginx:

```nginx
location /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_read_timeout 90s;
}
```

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

> Ojo: el `./backend/app/config.py` prefiere `DASHBOARD_` como prefijo para toda variable de entorno.

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

Abre el dashboard en el navegador: **http://localhost:3000**

---

## 5. URLs de acceso

| Servicio | URL |
|----------|-----|
| Frontend (dashboard) | http://localhost:3000 |
| API backend | http://localhost:8000 |
| Swagger UI (docs de la API) | http://localhost:8000/docs |
| PostgreSQL (desde tu máquina) | `localhost:5432` · `dashboard` / `dashboard` |
| Redis (desde tu máquina) | `localhost:6379` |

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

---

## 6. Configuración (variables de entorno)

Todas con prefijo `DASHBOARD_`. Las define `backend/app/config.py`.

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

- Nginx (frontend :3000) → `/api/*` → backend (FastAPI :8000).
- Backend cachéa respuestas externas en Redis (TTL por fuente: terremotos 5 min, GDELT 15 min, crypto 1 min, forex 12 h).
- El backend inicia una **tarea de ingestión** (`ingest.py`) que cada ~10 s consulta USGS, CoinGecko, Frankfurter, RSS de noticias, OpenSky, Open-Meteo, etc., y hace **upserts** en PostgreSQL.
- En el arranque (`lifespan`) se ejecuta `init_db()` y se siembran las webcams y frecuencias de radio base.

---

## 11. Solución de problemas

| Problema | Causa / Solución |
|----------|------------------|
| `port is already allocated` | Puertos `3000/5432/6379/8000` ocupados. Libera o cambia el mapeo de puertos en el compose. |
| El frontend no carga datos del mapa | Confirma que `/api/*` se proxiéa: `curl http://localhost:3000/api/health`. Si falla, revisa el `nginx.conf` `/` del frontend. |
| El backend no arranca | Revisa el healthcheck de BD: `docker compose logs postgres`. Espera a que `pg_isready` devuelva OK. |
| La clasificación de noticias no funciona | Revisa que `.env` tenga `DASHBOARD_GROQ_API_KEY` y que el container lo vea: `docker compose exec backend env \| grep GROQ` |
| Base de datos corrupta / tasa | Borra solo el volumen de datos: `docker compose down -v && docker compose up -d` |
| Cambios en el código que no se reflejan | Reconstruye las imágenes con `docker compose up --build -d` |

---

## 12. Alternativas: ejecutar sin Docker (desarrollo)

Sin Docker puedes correr el stack con **SQLite** (sin PostgreSQL, sin Redis; la caché cae a fallback):

```bash
# Terminal 1 — backend (usa SQLite en data/dashboard.db)
DASHBOARD_DB_TYPE=sqlite python3 -m uvicorn backend.app.main:app --reload --port 8000

# Terminal 2 — frontend (Vite con proxy a :8000)
cd frontend && npm install && npm run dev
```

Acceso: **http://localhost:5173**

Para usar PostgreSQL local sin Docker, exporta `DASHBOARD_DATABASE_URL` apuntando a tu instancia (`postgresql://user:pass@localhost:5432/dashboard`) y deja `DASHBOARD_DB_TYPE=postgres`.