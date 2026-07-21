"""
Hava durumu servisi (Anasayfa için).

5 il için güncel hava durumunu Open-Meteo'dan (anahtarsız, ücretsiz) çeker.
Dış çağrı kurumsal proxy üzerinden gider. Sonuç kısa süreli cache'lenir.
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from typing import List, Optional

from app.config import Settings
from app.services.http_client import make_async_client

# İl -> koordinat. İstenen 5 il.
CITIES = [
    {"name": "Adana", "lat": 37.0000, "lon": 35.3213},
    {"name": "İstanbul", "lat": 41.0082, "lon": 28.9784},
    {"name": "Ankara", "lat": 39.9334, "lon": 32.8597},
    {"name": "Eskişehir", "lat": 39.7767, "lon": 30.5206},
    {"name": "Elazığ", "lat": 38.6810, "lon": 39.2264},
]

# Open-Meteo WMO hava durumu kodu -> Türkçe açıklama + basit ikon anahtarı
_WMO = {
    0: ("Açık", "clear"),
    1: ("Az bulutlu", "mostly-clear"),
    2: ("Parçalı bulutlu", "partly-cloudy"),
    3: ("Kapalı", "cloudy"),
    45: ("Sisli", "fog"),
    48: ("Kırağılı sis", "fog"),
    51: ("Hafif çisenti", "drizzle"),
    53: ("Çisenti", "drizzle"),
    55: ("Yoğun çisenti", "drizzle"),
    61: ("Hafif yağmur", "rain"),
    63: ("Yağmur", "rain"),
    65: ("Kuvvetli yağmur", "rain"),
    71: ("Hafif kar", "snow"),
    73: ("Kar", "snow"),
    75: ("Yoğun kar", "snow"),
    77: ("Kar taneleri", "snow"),
    80: ("Hafif sağanak", "showers"),
    81: ("Sağanak", "showers"),
    82: ("Kuvvetli sağanak", "showers"),
    95: ("Gök gürültülü fırtına", "thunder"),
    96: ("Dolu ile fırtına", "thunder"),
    99: ("Kuvvetli dolu fırtınası", "thunder"),
}


@dataclass
class CityWeather:
    name: str
    temperature: Optional[float]
    description: str
    icon: str
    wind: Optional[float]
    error: Optional[str] = None


class WeatherService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._cache: Optional[List[dict]] = None
        self._cache_ts: float = 0.0

    async def get_all(self) -> List[dict]:
        now = time.monotonic()
        if (
            self._cache is not None
            and now - self._cache_ts < self._settings.weather_cache_seconds
        ):
            return self._cache

        results: List[CityWeather] = []
        async with make_async_client(self._settings, timeout=12) as client:
            for city in CITIES:
                try:
                    resp = await client.get(
                        "https://api.open-meteo.com/v1/forecast",
                        params={
                            "latitude": city["lat"],
                            "longitude": city["lon"],
                            "current": "temperature_2m,weather_code,wind_speed_10m",
                            "timezone": "Europe/Istanbul",
                        },
                    )
                    resp.raise_for_status()
                    cur = resp.json().get("current", {})
                    code = int(cur.get("weather_code", -1))
                    desc, icon = _WMO.get(code, ("Bilinmiyor", "unknown"))
                    results.append(CityWeather(
                        name=city["name"],
                        temperature=cur.get("temperature_2m"),
                        description=desc,
                        icon=icon,
                        wind=cur.get("wind_speed_10m"),
                    ))
                except Exception as exc:  # tek il hata verse diğerleri gelsin
                    results.append(CityWeather(
                        name=city["name"],
                        temperature=None,
                        description="Alınamadı",
                        icon="unknown",
                        wind=None,
                        error=str(exc),
                    ))

        data = [asdict(r) for r in results]
        self._cache = data
        self._cache_ts = now
        return data
