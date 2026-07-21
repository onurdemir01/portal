"""
Envanter servisi.

Sorumluluklar:
  - Uygulama DB'sinde tutulan tablo eşlemelerini (gerçek tablo adı ↔ yan menüde
    görünen ad) okumak/güncellemek. Görünen adları admin ekrandan değiştirir.
  - Bir tablonun kolonlarını INFORMATION_SCHEMA'dan keşfetmek (kullanıcı
    kolonları aç/kapa/sırala yapabilsin).
  - Güvenli sorgu çalıştırmak: hem tablo bazlı (kolon+sıralama seçimli) hem de
    "Custom Query" (SELECT-only guard'dan geçen ham SQL).
  - Sonucu CSV'ye dönüştürmek.

Envanter DB kullanıcısı tam yetkili olduğundan, Custom Query yolu HER ZAMAN
query_guard.validate_select_only() üzerinden geçer. Statement timeout ve satır
limiti uygulanır.
"""

from __future__ import annotations

from typing import Dict, List, Optional

import csv
import io
from dataclasses import dataclass

import pyodbc

from app.config import Settings
from app.security.query_guard import validate_select_only

# Uygulamanın erişmesine izin verilen tablolar (whitelist). Yan menüdeki
# görünen adlar uygulama DB'sinde saklanır; bu liste "hangi gerçek tablolara
# tablo-görünümü açılabilir"i sınırlar. Custom Query bu whitelist ile
# sınırlı DEĞİLDİR (kullanıcı JOIN vb. yapabilir) ama yalnızca SELECT'tir.
DEFAULT_TABLES = [
    "Inventory",
    "MWAppsInventory",
    "IPInventory",
    "InitSriptsInventory",
    "InitSriptsInventory8",
    "BMW_Certificates",
    "BMW_Certificates_Inventory",
]

# Tanımlayıcı (tablo/kolon adı) doğrulama: yalnızca güvenli karakterler.
import re as _re
_IDENT_RE = _re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _validate_identifier(name: str) -> str:
    if not _IDENT_RE.match(name or ""):
        raise ValueError(f"Geçersiz tanımlayıcı: {name!r}")
    return name


@dataclass
class QueryResult:
    columns: List[str]
    rows: List[list]
    row_count: int
    truncated: bool


class InventoryService:
    def __init__(self, settings: Settings):
        self._settings = settings

    def _connect(self) -> pyodbc.Connection:
        conn = pyodbc.connect(
            self._settings.inventory_odbc_dsn,
            timeout=self._settings.inventory_query_timeout_seconds,
            readonly=True,  # sürücü seviyesinde read-only ipucu
        )
        # Sorgu (statement) zaman aşımı
        conn.timeout = self._settings.inventory_query_timeout_seconds
        return conn

    def list_columns(self, table_name: str) -> List[str]:
        """Bir tablonun kolonlarını sıralı olarak döner."""
        _validate_identifier(table_name)
        sql = (
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION"
        )
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute(sql, table_name)
            return [r[0] for r in cur.fetchall()]

    def query_table(
        self,
        table_name: str,
        *,
        columns: Optional[List[str]] = None,
        order_by: Optional[str] = None,
        descending: bool = False,
    ) -> QueryResult:
        """
        Tablo bazlı güvenli sorgu: kolon seçimi + sıralama. Tüm tanımlayıcılar
        doğrulanır ve köşeli parantezle sarılır (SQL Server quoting).
        """
        _validate_identifier(table_name)
        available = self.list_columns(table_name)

        if columns:
            for c in columns:
                if c not in available:
                    raise ValueError(f"Bilinmeyen kolon: {c!r}")
            select_cols = ", ".join(f"[{c}]" for c in columns)
        else:
            select_cols = "*"

        order_clause = ""
        if order_by:
            if order_by not in available:
                raise ValueError(f"Bilinmeyen sıralama kolonu: {order_by!r}")
            direction = "DESC" if descending else "ASC"
            order_clause = f" ORDER BY [{order_by}] {direction}"

        top = int(self._settings.inventory_max_rows)
        sql = f"SELECT TOP ({top}) {select_cols} FROM [{table_name}]{order_clause}"
        return self._execute(sql)

    def custom_query(self, raw_sql: str) -> QueryResult:
        """SELECT-only guard'dan geçen ham kullanıcı sorgusu."""
        safe = validate_select_only(
            raw_sql, max_rows=self._settings.inventory_max_rows
        )
        return self._execute(safe.sql)

    def _execute(self, sql: str) -> QueryResult:
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute(sql)
            columns = [d[0] for d in cur.description] if cur.description else []
            fetched = cur.fetchall()
            rows = [list(r) for r in fetched]
        truncated = len(rows) >= int(self._settings.inventory_max_rows)
        return QueryResult(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            truncated=truncated,
        )


def to_csv(result: QueryResult) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(result.columns)
    for row in result.rows:
        writer.writerow(
            ["" if v is None else str(v) for v in row]
        )
    return buf.getvalue()
