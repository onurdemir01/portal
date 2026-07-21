"""
LDAP / Active Directory kimlik doğrulama.

Akış:
  1. Servis hesabı (bind DN) ile bağlan.
  2. Kullanıcıyı sAMAccountName ile ara, DN'ini bul.
  3. Kullanıcının kendi parolasıyla yeniden bind ederek parolayı doğrula.
  4. Kullanıcının grup üyeliklerini (memberOf, iç içe gruplar dahil) çöz.
  5. Admin grubuna üye olup olmadığını belirle.

Girişe yetkili grup: yalnızca admin grubuna üye olanlar mı girebilir, yoksa
kimliği doğrulanan herkes public alanı görüp adminler mi ekstra yetki alır —
bu politikayı is_admin bayrağıyla üst katmana bırakıyoruz. Şu anki kurulumda
admin grubu = LDAP_ADMIN_GROUP.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from dataclasses import dataclass

from ldap3 import ALL, SUBTREE, Connection, Server
from ldap3.core.exceptions import LDAPException

from app.config import Settings

logger = logging.getLogger("ldap_auth")


class LDAPAuthError(Exception):
    """Kimlik doğrulama başarısız (kullanıcı yok / parola yanlış / erişim)."""


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str          # sAMAccountName
    display_name: str
    email: Optional[str]
    dn: str
    is_admin: bool


def _server(settings: Settings) -> Server:
    return Server(
        settings.ldap_server,
        port=settings.ldap_port,
        use_ssl=settings.ldap_use_ssl,
        get_info=ALL,
    )


def _escape_filter(value: str) -> str:
    """LDAP filtre enjeksiyonuna karşı özel karakterleri escape eder."""
    replacements = {
        "\\": r"\5c", "*": r"\2a", "(": r"\28", ")": r"\29", "\x00": r"\00",
    }
    return "".join(replacements.get(ch, ch) for ch in value)


def authenticate(username: str, password: str, settings: Settings) -> AuthenticatedUser:
    if not username or not password:
        raise LDAPAuthError("Kullanıcı adı ve parola zorunludur.")

    safe_username = _escape_filter(username.strip())
    server = _server(settings)

    # 1) Servis hesabı ile bağlan
    try:
        svc_conn = Connection(
            server,
            user=settings.ldap_bind_dn,
            password=settings.ldap_bind_password,
            auto_bind=True,
        )
        logger.info("LDAP: servis hesabi bind BASARILI (%s:%s ssl=%s)",
                    settings.ldap_server, settings.ldap_port, settings.ldap_use_ssl)
    except LDAPException as exc:
        # Servis hesabı sorunları kullanıcıya sızdırılmaz; loglanmalı.
        logger.error("LDAP: servis hesabi bind BASARISIZ: %r", exc)
        raise LDAPAuthError("Kimlik doğrulama servisine bağlanılamadı.") from exc

    try:
        # 2) Kullanıcıyı sAMAccountName ile ara
        search_filter = f"({settings.ldap_user_attr}={safe_username})"
        logger.info("LDAP: kullanici araniyor filter=%s base=%s",
                    search_filter, settings.ldap_base_dn)
        svc_conn.search(
            search_base=settings.ldap_base_dn,
            search_filter=search_filter,
            search_scope=SUBTREE,
            attributes=["distinguishedName", "displayName", "mail", "memberOf"],
        )
        logger.info("LDAP: arama sonucu %d kayit", len(svc_conn.entries))
        if not svc_conn.entries:
            logger.warning("LDAP: kullanici BULUNAMADI (sAMAccountName=%s)", safe_username)
            raise LDAPAuthError("Kullanıcı adı veya parola hatalı.")

        entry = svc_conn.entries[0]
        user_dn = str(entry.distinguishedName.value)
        display_name = (
            str(entry.displayName.value) if entry.displayName else username
        )
        email = str(entry.mail.value) if entry.mail else None
        member_of = entry.memberOf.values if entry.memberOf else []
    finally:
        svc_conn.unbind()

    logger.info("LDAP: kullanici bulundu dn=%s, memberOf sayisi=%d",
                user_dn, len(member_of))

    # 3) Kullanıcının kendi parolasıyla bind ederek parolayı doğrula
    try:
        user_conn = Connection(
            server, user=user_dn, password=password, auto_bind=True
        )
        user_conn.unbind()
        logger.info("LDAP: kullanici parola bind BASARILI dn=%s", user_dn)
    except LDAPException as exc:
        logger.warning("LDAP: kullanici parola bind BASARISIZ dn=%s: %r", user_dn, exc)
        raise LDAPAuthError("Kullanıcı adı veya parola hatalı.")

    # 4-5) Admin grup üyeliği. Not: memberOf doğrudan üyelikleri verir.
    # İç içe (nested) grup çözümü gerekiyorsa LDAP_MATCHING_RULE_IN_CHAIN
    # (1.2.840.113556.1.4.1941) ile ayrı bir arama eklenebilir.
    admin_group = settings.ldap_admin_group.lower()
    is_admin = any(g.lower() == admin_group for g in member_of)

    return AuthenticatedUser(
        username=username.strip(),
        display_name=display_name,
        email=email,
        dn=user_dn,
        is_admin=is_admin,
    )
