"""
Uygulama DB modelleri (envanter DB'sinden AYRI).

Burada tutulanlar:
  - FeatureFlag: hangi ekran/modül public'te görünür (admin aç/kapa yapar).
  - InventoryTableMap: gerçek tablo adı ↔ yan menüde görünen ad + görünürlük
    + izinli kolonlar (admin yönetir).
  - SelfServiceItem: her self-servis hizmetin tanımı (Ansible template vb.).
  - AuditLog: kim ne zaman ne yaptı (özellikle custom query ve self-servis
    tetiklemeleri için önemli).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # örn: "nobetciler", "envanterler", "self_servis"
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(128))
    # Public kullanıcılar (admin olmayanlar) görebilir mi?
    public_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryTableMap(Base):
    __tablename__ = "inventory_table_map"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    real_table: Mapped[str] = mapped_column(String(128), unique=True)
    # Yan menüde görünen ad — admin ekrandan değiştirebilir.
    display_name: Mapped[str] = mapped_column(String(128))
    public_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class SelfServiceItem(Base):
    __tablename__ = "self_service_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(128))
    # Ansible job template id / iş akışı tanımlayıcısı
    ansible_template_id: Mapped[str] = mapped_column(String(64), default="")
    # Form alanları vb. için JSON şema (metin olarak saklanır)
    form_schema: Mapped[str] = mapped_column(Text, default="{}")
    # Çıktı dosyalarının bırakılacağı alt dizin (SELFSERVICE_FILES_ROOT altında)
    output_subdir: Mapped[str] = mapped_column(String(256), default="")
    public_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    username: Mapped[str] = mapped_column(String(128), index=True)
    action: Mapped[str] = mapped_column(String(64))
    detail: Mapped[str] = mapped_column(Text, default="")
