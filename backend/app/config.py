"""
Uygulama yapılandırması. TÜM hassas değerler ortam değişkenlerinden okunur;
hiçbir kimlik bilgisi koda gömülü değildir. Değerleri .env dosyasından ya da
OpenShift Secret / Vault üzerinden sağlayın.

Örnek için backend/.env.example dosyasına bakın.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Oturum / güvenlik ---
    # Nginx TLS'i termine ettiği için cookie 'secure' olarak işaretlenir.
    session_secret: str = Field(..., alias="SESSION_SECRET")
    session_cookie_name: str = "portal_session"
    session_ttl_minutes: int = 480

    # --- LDAP / Active Directory ---
    ldap_server: str = Field(..., alias="LDAP_SERVER")
    ldap_port: int = Field(3269, alias="LDAP_PORT")
    ldap_use_ssl: bool = Field(True, alias="LDAP_USE_SSL")
    ldap_bind_dn: str = Field(..., alias="LDAP_BIND_DN")
    ldap_bind_password: str = Field(..., alias="LDAP_BIND_PASSWORD")
    ldap_base_dn: str = Field(..., alias="LDAP_BASE_DN")
    ldap_admin_group: str = Field(..., alias="LDAP_ADMIN_GROUP")
    # Kullanıcı kısa kullanıcı adı (sAMAccountName) ile giriş yapar.
    ldap_user_attr: str = "sAMAccountName"

    # --- Nöbetçi API ---
    nobetci_api_url: str = Field(..., alias="NOBETCI_API_URL")
    nobetci_cache_seconds: int = 300

    # --- Dış istekler için proxy ve SSL doğrulama ---
    # Kurumsal proxy (iç API'lere ve internete çıkış buradan). Boşsa proxy yok.
    # Örn: http://tekprxv2.fw.garanti.com.tr:80
    outbound_proxy: str = Field("", alias="OUTBOUND_PROXY")
    # Kurumsal CA sertifika dosyası (proxy TLS'i yeniden imzalıyorsa).
    # Örn: /etc/pki/tls/certs/ca-bundle.crt veya kurumsal CA .pem yolu.
    # Boşsa ve verify_ssl=false ise doğrulama kapatılır (iç ağ için pratik).
    outbound_ca_bundle: str = Field("", alias="OUTBOUND_CA_BUNDLE")
    verify_ssl: bool = Field(True, alias="VERIFY_SSL")

    # --- Hava durumu (Anasayfa) ---
    # Open-Meteo ücretsiz ve anahtarsız; internet erişimi proxy üzerinden.
    weather_cache_seconds: int = 900

    # --- Envanter DB (SQL Server, ODBC) ---
    # Tam ODBC connection string ortam değişkeninden gelir.
    inventory_odbc_dsn: str = Field(..., alias="INVENTORY_ODBC_DSN")
    inventory_query_timeout_seconds: int = 30
    inventory_max_rows: int = 5000

    # --- Uygulama DB (feature-flag, tablo eşlemeleri, audit) ---
    # Ayrı, hafif bir DB. Örn: sqlite:///./app_data/portal.db veya bir Postgres DSN.
    app_db_url: str = Field("sqlite:///./app_data/portal.db", alias="APP_DB_URL")

    # --- Branding (logo/favicon) ---
    # Admin panelinden yüklenen logo bu dizine kaydedilir.
    branding_dir: str = Field("./app_data/branding", alias="BRANDING_DIR")

    # --- Nöbetçi fotoğrafları ---
    # Sicil no (registryId) bazlı kaydedilir: <registryId>.<ext>
    photos_dir: str = Field("./app_data/photos", alias="PHOTOS_DIR")

    # --- Ansible / AAP (Self-Servis) — sonra doldurulacak ---
    ansible_base_url: str = Field("", alias="ANSIBLE_BASE_URL")
    ansible_token: str = Field("", alias="ANSIBLE_TOKEN")
    # Self-servis dosya çıktılarının bırakıldığı taban dizin (path traversal
    # koruması için tüm indirmeler bu dizinin altında olmak zorunda).
    selfservice_files_root: str = Field(
        "./selfservice_output", alias="SELFSERVICE_FILES_ROOT"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
