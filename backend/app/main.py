"""
FastAPI uygulaması — route'lar ve oturum yönetimi.

Oturum: LDAP ile doğrulanan kullanıcı için imzalı bir cookie kurulur
(itsdangerous). Nginx TLS'i termine ettiği için cookie Secure + HttpOnly +
SameSite=Lax işaretlenir. Admin yetkisi cookie içindeki is_admin ile taşınır.

Yetki modeli:
  - Kimliği doğrulanan her kullanıcı giriş yapabilir.
  - public_enabled=False olan modüller/tablolar yalnızca adminlere görünür.
  - /admin/* uçları yalnızca admin.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import List, Optional

import json

logging.basicConfig(level=logging.INFO)

from fastapi import Depends, FastAPI, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import PlainTextResponse, FileResponse, RedirectResponse
from itsdangerous import BadSignature, URLSafeSerializer
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.security.ldap_auth import LDAPAuthError, authenticate
from app.security.query_guard import QueryValidationError
from app.services.inventory import InventoryService, to_csv
from app.services.nobetci import NobetciService, serialize
from app.services.weather import WeatherService

app = FastAPI(title="Middleware Portal")


# --- Oturum yardımcıları ---

def _serializer(settings: Settings) -> URLSafeSerializer:
    return URLSafeSerializer(settings.session_secret, salt="portal-session")


def current_user(request: Request, settings: Settings = Depends(get_settings)) -> dict:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Oturum bulunamadı.")
    try:
        return _serializer(settings).loads(token)
    except BadSignature:
        raise HTTPException(status_code=401, detail="Geçersiz oturum.")


def require_admin(user: dict = Depends(current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gerekir.")
    return user


# --- Auth ---

class LoginBody(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
def login(
    body: LoginBody,
    response: Response,
    settings: Settings = Depends(get_settings),
):
    try:
        auth_user = authenticate(body.username, body.password, settings)
    except LDAPAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    payload = {
        "username": auth_user.username,
        "display_name": auth_user.display_name,
        "email": auth_user.email,
        "is_admin": auth_user.is_admin,
    }
    token = _serializer(settings).dumps(payload)
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_ttl_minutes * 60,
        httponly=True,
        secure=True,       # Nginx TLS termination
        samesite="lax",
    )
    return payload


@app.post("/api/auth/logout")
def logout(response: Response, settings: Settings = Depends(get_settings)):
    response.delete_cookie(settings.session_cookie_name)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)):
    return user


# --- Nöbetçiler ---

@app.get("/api/nobetciler/current")
async def nobetci_current(
    user: dict = Depends(current_user),
    settings: Settings = Depends(get_settings),
):
    svc = NobetciService(settings)
    return {"current": serialize(await svc.get_current())}


@app.get("/api/nobetciler/schedule")
async def nobetci_schedule(
    user: dict = Depends(current_user),
    settings: Settings = Depends(get_settings),
):
    svc = NobetciService(settings)
    return {"schedule": [serialize(e) for e in await svc.get_schedule()]}


# --- Hava durumu (Anasayfa) ---

_weather_service: Optional[WeatherService] = None


@app.get("/api/weather")
async def weather(
    user: dict = Depends(current_user),
    settings: Settings = Depends(get_settings),
):
    global _weather_service
    if _weather_service is None:
        _weather_service = WeatherService(settings)
    return {"cities": await _weather_service.get_all()}


# --- Envanter ---

@app.get("/api/inventory/{table}/columns")
def inventory_columns(
    table: str,
    user: dict = Depends(current_user),
    settings: Settings = Depends(get_settings),
):
    svc = InventoryService(settings)
    try:
        return {"columns": svc.list_columns(table)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class TableQueryBody(BaseModel):
    columns: Optional[List[str]] = None
    order_by: Optional[str] = None
    descending: bool = False
    filters: Optional[List[dict]] = None


@app.post("/api/inventory/{table}/query")
def inventory_query(
    table: str,
    body: TableQueryBody,
    user: dict = Depends(current_user),
    settings: Settings = Depends(get_settings),
):
    svc = InventoryService(settings)
    try:
        res = svc.query_table(
            table,
            columns=body.columns,
            order_by=body.order_by,
            descending=body.descending,
            filters=body.filters,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "columns": res.columns,
        "rows": res.rows,
        "row_count": res.row_count,
        "truncated": res.truncated,
    }


class CustomQueryBody(BaseModel):
    sql: str


@app.post("/api/inventory/custom-query")
def inventory_custom_query(
    body: CustomQueryBody,
    user: dict = Depends(current_user),
    settings: Settings = Depends(get_settings),
):
    svc = InventoryService(settings)
    try:
        res = svc.custom_query(body.sql)
    except QueryValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # DB hatası vb.
        raise HTTPException(status_code=400, detail=f"Sorgu çalıştırılamadı: {exc}")
    return {
        "columns": res.columns,
        "rows": res.rows,
        "row_count": res.row_count,
        "truncated": res.truncated,
    }


@app.post("/api/inventory/custom-query/csv")
def inventory_custom_query_csv(
    body: CustomQueryBody,
    user: dict = Depends(current_user),
    settings: Settings = Depends(get_settings),
):
    svc = InventoryService(settings)
    try:
        res = svc.custom_query(body.sql)
    except QueryValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    csv_text = to_csv(res)
    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventory_export.csv"},
    )


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


# --- Branding (logo / favicon) ---

# İzin verilen görsel tipleri ve uzantıları
_ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico",
    "image/webp": ".webp",
}
_MAX_LOGO_BYTES = 2 * 1024 * 1024  # 2 MB


def _branding_path(settings: Settings) -> Path:
    d = Path(settings.branding_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _find_logo(settings: Settings) -> Optional[Path]:
    d = _branding_path(settings)
    for ext in (".png", ".svg", ".jpg", ".webp", ".ico"):
        p = d / f"logo{ext}"
        if p.exists():
            return p
    return None


@app.post("/api/branding/logo")
async def upload_logo(
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
    settings: Settings = Depends(get_settings),
):
    """Admin logo yükler. Sadece görsel tipleri, en fazla 2 MB."""
    ext = _ALLOWED_IMAGE_TYPES.get(file.content_type)
    if not ext:
        raise HTTPException(
            status_code=400,
            detail="Yalnızca PNG, JPG, SVG, WEBP veya ICO yükleyebilirsiniz.",
        )
    data = await file.read()
    if len(data) > _MAX_LOGO_BYTES:
        raise HTTPException(status_code=400, detail="Dosya 2 MB'tan büyük olamaz.")

    d = _branding_path(settings)
    # Eski logoları temizle (tek logo tutulur)
    for old in d.glob("logo.*"):
        try:
            old.unlink()
        except OSError:
            pass
    (d / f"logo{ext}").write_bytes(data)
    return {"ok": True, "type": file.content_type}


@app.delete("/api/branding/logo")
def delete_logo(
    user: dict = Depends(require_admin),
    settings: Settings = Depends(get_settings),
):
    d = _branding_path(settings)
    removed = False
    for old in d.glob("logo.*"):
        try:
            old.unlink()
            removed = True
        except OSError:
            pass
    return {"ok": True, "removed": removed}


@app.get("/api/branding/logo")
def get_logo(settings: Settings = Depends(get_settings)):
    """Sol üst köşede gösterilecek logo (giriş gerektirmez, herkese açık)."""
    logo = _find_logo(settings)
    if not logo:
        raise HTTPException(status_code=404, detail="Logo yüklenmemiş.")
    return FileResponse(str(logo))


@app.get("/api/branding/favicon")
def get_favicon(settings: Settings = Depends(get_settings)):
    """Sekmede gösterilecek favicon. Logo yoksa varsayılana yönlendirir."""
    logo = _find_logo(settings)
    if logo:
        return FileResponse(str(logo))
    # Logo yoksa boş/varsayılan — 404 yerine sessizce boş favicon
    return Response(status_code=204)


@app.get("/api/branding/status")
def branding_status(settings: Settings = Depends(get_settings)):
    """Frontend logo var mı diye buradan öğrenir."""
    return {"has_logo": _find_logo(settings) is not None}


# --- Nöbetçi fotoğrafları (sicil no bazlı) ---

import re as _re
_REGISTRY_RE = _re.compile(r"^[A-Za-z0-9_-]{1,32}$")  # güvenli sicil no


def _photos_path(settings: Settings) -> Path:
    d = Path(settings.photos_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _find_photo(settings: Settings, registry_id: str) -> Optional[Path]:
    if not _REGISTRY_RE.match(registry_id or ""):
        return None
    d = _photos_path(settings)
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        p = d / f"{registry_id}{ext}"
        if p.exists():
            return p
    return None


@app.post("/api/photos/{registry_id}")
async def upload_photo(
    registry_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_admin),
    settings: Settings = Depends(get_settings),
):
    """Admin bir sicil no için fotoğraf yükler. Sadece JPG/PNG/WEBP, en fazla 2 MB."""
    if not _REGISTRY_RE.match(registry_id):
        raise HTTPException(status_code=400, detail="Geçersiz sicil no.")
    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    ext = ext_map.get(file.content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Yalnızca JPG, PNG veya WEBP.")
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Dosya 2 MB'tan büyük olamaz.")

    d = _photos_path(settings)
    # Aynı sicil no için eski fotoğrafları temizle (tek foto tutulur)
    for old in d.glob(f"{registry_id}.*"):
        try:
            old.unlink()
        except OSError:
            pass
    (d / f"{registry_id}{ext}").write_bytes(data)
    return {"ok": True, "registry_id": registry_id}


@app.delete("/api/photos/{registry_id}")
def delete_photo(
    registry_id: str,
    user: dict = Depends(require_admin),
    settings: Settings = Depends(get_settings),
):
    if not _REGISTRY_RE.match(registry_id):
        raise HTTPException(status_code=400, detail="Geçersiz sicil no.")
    d = _photos_path(settings)
    removed = False
    for old in d.glob(f"{registry_id}.*"):
        try:
            old.unlink()
            removed = True
        except OSError:
            pass
    return {"ok": True, "removed": removed}


@app.get("/api/photos/{registry_id}")
def get_photo(
    registry_id: str,
    user: dict = Depends(current_user),
    settings: Settings = Depends(get_settings),
):
    """Bir sicil no için fotoğrafı döner. Giriş yapmış kullanıcılara açık."""
    photo = _find_photo(settings, registry_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Fotoğraf yok.")
    return FileResponse(str(photo))


@app.get("/api/photos")
def list_photos(
    user: dict = Depends(require_admin),
    settings: Settings = Depends(get_settings),
):
    """Yüklenmiş fotoğrafların sicil no listesi (admin panelinde göstermek için)."""
    d = _photos_path(settings)
    ids = sorted({p.stem for p in d.glob("*.*")})
    return {"registry_ids": ids}
