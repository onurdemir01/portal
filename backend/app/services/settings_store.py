"""
Basit JSON tabanlı ayar deposu (feature-flag'ler için).

DB kurulum yükü olmadan, app_data/config.json içinde kalıcı ayar tutar.
Hangi modüllerin (Anasayfa, Nöbetçiler, Envanterler, Self-Servis) public
kullanıcılara (admin olmayan) görüneceğini yönetir.

Adminler her zaman her şeyi görür; flag yalnızca public görünürlüğü belirler.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Dict

from app.config import Settings

_lock = threading.Lock()

# Modül anahtarları ve varsayılan (public açık mı) değerleri
DEFAULT_FLAGS: Dict[str, bool] = {
    "anasayfa": True,
    "nobetciler": True,
    "envanterler": True,
    "self_servis": True,
}

# Kullanıcıya gösterilecek etiketler
FLAG_LABELS: Dict[str, str] = {
    "anasayfa": "Anasayfa",
    "nobetciler": "Nöbetçiler",
    "envanterler": "Envanterler",
    "self_servis": "Self-Servis Hizmetler",
}


def _config_path(settings: Settings) -> Path:
    # app_db_url'den değil, app_data kökünden türet
    base = Path(settings.branding_dir).parent  # app_data
    base.mkdir(parents=True, exist_ok=True)
    return base / "config.json"


def _read(settings: Settings) -> dict:
    p = _config_path(settings)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _write(settings: Settings, data: dict) -> None:
    p = _config_path(settings)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_flags(settings: Settings) -> Dict[str, dict]:
    """Tüm flag'leri etiketleriyle döner: {key: {label, public_enabled}}."""
    stored = _read(settings).get("feature_flags", {})
    result = {}
    for key, default in DEFAULT_FLAGS.items():
        result[key] = {
            "label": FLAG_LABELS.get(key, key),
            "public_enabled": bool(stored.get(key, default)),
        }
    return result


def set_flag(settings: Settings, key: str, public_enabled: bool) -> Dict[str, dict]:
    """Bir flag'i günceller ve güncel tüm flag setini döner."""
    if key not in DEFAULT_FLAGS:
        raise ValueError(f"Bilinmeyen modül: {key!r}")
    with _lock:
        data = _read(settings)
        flags = data.get("feature_flags", {})
        flags[key] = bool(public_enabled)
        data["feature_flags"] = flags
        _write(settings, data)
    return get_flags(settings)
