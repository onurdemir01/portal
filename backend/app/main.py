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
from typing import List, Optional

import json

logging.basicConfig(level=logging.INFO)

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse
from itsdangerous import BadSignature, URLSafeSerializer
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.security.ldap_auth import LDAPAuthError, authenticate
from app.security.query_guard import QueryValidationError
from app.services.inventory import InventoryService, to_csv
from app.services.nobetci import NobetciService, serialize

app = FastAPI(title="Nöbetçi & Envanter Portalı")


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
