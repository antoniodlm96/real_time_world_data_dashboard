from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_earthquake: int = 300
    cache_ttl_gdelt: int = 900
    cache_ttl_crypto: int = 60
    cache_ttl_forex: int = 43200
    db_path: str = "data/dashboard.db"
    api_prefix: str = "/api"
    cors_origins: str = "http://localhost:5173"
    usgs_url: str = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
    gdelt_url: str = "https://api.gdeltproject.org/api/v2/doc/doc"
    coingecko_url: str = "https://api.coingecko.com/api/v3"
    frankfurter_url: str = "https://api.frankfurter.dev/latest"
    groq_api_key: str = ""
    firms_api_key: str = ""

    model_config = {"env_prefix": "DASHBOARD_", "env_file": ".env"}


settings = Settings()
