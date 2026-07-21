"""
Dış HTTP istekleri için ortak httpx AsyncClient fabrikası.

Kurumsal ortamda tüm dış çağrılar proxy üzerinden çıkar ve proxy TLS'i kendi
CA'sıyla yeniden imzalayabilir. Bu modül proxy ve SSL doğrulama ayarını tek
yerden yönetir; nöbetçi ve hava durumu servisleri bunu kullanır.

SSL doğrulama önceliği:
  1. outbound_ca_bundle verilmişse -> o CA dosyasıyla doğrula (en güvenli).
  2. verify_ssl=False ise -> doğrulama kapalı (iç ağ için pratik ama zayıf).
  3. Aksi halde -> sistem varsayılanı ile doğrula.
"""

from __future__ import annotations

from typing import Optional

import httpx

from app.config import Settings


def make_async_client(settings: Settings, timeout: float = 15) -> httpx.AsyncClient:
    # SSL verify değeri: CA dosyası > verify_ssl bayrağı
    if settings.outbound_ca_bundle:
        verify: object = settings.outbound_ca_bundle
    else:
        verify = settings.verify_ssl

    kwargs = {"timeout": timeout, "verify": verify}

    # Proxy verilmişse tüm şemalar için kullan
    if settings.outbound_proxy:
        kwargs["proxy"] = settings.outbound_proxy

    return httpx.AsyncClient(**kwargs)
