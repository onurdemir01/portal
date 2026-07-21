"""
Nöbetçi servisi.

Kaynak API takım kayıtlarını döner; her kayıtta bir tarih aralığı
(startDate-endDate), asıl nöbetçi (asNobetci) ve yedek (yedekNobetci) bulunur.

Bu servis:
  - API çıktısını sadeleştirilmiş bir modele indirger,
  - "bugünün nöbetçisi"ni (şu an aralığın içindeyse) belirler,
  - sonucu kısa süreli cache'ler (API her istekte çağrılmasın).
"""

from __future__ import annotations

from typing import Dict, List, Optional

import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

import httpx

from app.config import Settings
from app.services.http_client import make_async_client


@dataclass
class Person:
    registry_id: Optional[str]
    full_name: str
    phone: Optional[str]
    intercom: Optional[str]
    email: Optional[str]
    role: Optional[str]


@dataclass
class ShiftEntry:
    start: str          # ISO
    end: str            # ISO
    primary: Optional[Person]
    backup: Optional[Person]
    is_current: bool


def _person(node: Optional[dict]) -> Optional[Person]:
    if not node:
        return None
    role = node.get("role") or {}
    return Person(
        registry_id=node.get("registryId"),
        full_name=(node.get("fullName") or "").strip(),
        phone=node.get("phoneNumber"),
        intercom=node.get("intercom"),
        email=node.get("email"),
        # Kaynakta rol adı sonunda \r\n olabiliyor — temizliyoruz.
        role=(role.get("name") or "").strip() or None,
    )


def _parse_dt(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


class NobetciService:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._cache: Optional[List[dict]] = None
        self._cache_ts: float = 0.0

    async def _fetch_raw(self) -> List[dict]:
        now = time.monotonic()
        if (
            self._cache is not None
            and now - self._cache_ts < self._settings.nobetci_cache_seconds
        ):
            return self._cache

        async with make_async_client(self._settings, timeout=15) as client:
            resp = await client.get(self._settings.nobetci_api_url)
            resp.raise_for_status()
            data = resp.json()

        if not isinstance(data, list):
            data = []
        self._cache = data
        self._cache_ts = now
        return data

    async def get_schedule(self) -> List[ShiftEntry]:
        raw = await self._fetch_raw()
        now = datetime.now(timezone.utc)
        entries: List[ShiftEntry] = []

        for rec in raw:
            start = _parse_dt(rec.get("startDate", ""))
            end = _parse_dt(rec.get("endDate", ""))
            is_current = bool(
                start and end and start <= now.astimezone(start.tzinfo) < end
            )
            entries.append(
                ShiftEntry(
                    start=rec.get("startDate", ""),
                    end=rec.get("endDate", ""),
                    primary=_person(rec.get("asNobetci")),
                    backup=_person(rec.get("yedekNobetci")),
                    is_current=is_current,
                )
            )

        entries.sort(key=lambda e: e.start)
        return entries

    async def get_current(self) -> Optional[ShiftEntry]:
        for entry in await self.get_schedule():
            if entry.is_current:
                return entry
        return None


def serialize(entry: Optional[ShiftEntry]) -> Optional[dict]:
    return asdict(entry) if entry else None
