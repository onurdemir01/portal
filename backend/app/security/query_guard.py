"""
SELECT-only query guard.

Bu modül, kullanıcıların "Custom Query" ekranından gönderdiği ham SQL'i
çalıştırmadan ÖNCE doğrular. Envanter DB kullanıcısı tam yetkili olduğu için
bu katman tek savunma hattıdır — bu yüzden birden fazla kontrol uygular ve
şüpheli her durumda REDDEDER (fail-closed).

NOT: En sağlam koruma yine de read-only bir DB kullanıcısıdır. Bu katman
ikinci savunma hattı olarak tasarlanmıştır; ileride read-only kullanıcı
açıldığında bu guard yerinde kalmaya devam eder.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


class QueryValidationError(ValueError):
    """Sorgu güvenlik kontrolünden geçemediğinde fırlatılır."""


# Sorgunun İÇİNDE hiçbir yerde geçmemesi gereken yazma/DDL/prosedür anahtar
# kelimeleri. Kelime sınırı (\b) ile aranır, böylece 'updated_at' gibi kolon
# adları yanlışlıkla eşleşmez.
_FORBIDDEN_KEYWORDS = (
    "insert", "update", "delete", "drop", "alter", "create", "truncate",
    "merge", "exec", "execute", "grant", "revoke", "deny", "backup",
    "restore", "shutdown", "reconfigure", "sp_", "xp_", "into", "openrowset",
    "opendatasource", "openquery", "waitfor", "dbcc", "kill", "bulk",
)

_FORBIDDEN_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in _FORBIDDEN_KEYWORDS) + r")\b",
    re.IGNORECASE,
)

# İzin verilen başlangıçlar: SELECT veya CTE (WITH ... SELECT).
_ALLOWED_START_RE = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)


@dataclass(frozen=True)
class SafeQuery:
    """Doğrulanmış ve limit uygulanmış sorgu."""
    sql: str
    row_limit: int


def _strip_comments(sql: str) -> str:
    """
    -- satır yorumlarını ve /* */ blok yorumlarını temizler.
    Yorum içine gizlenmiş komutların kontrolü atlamasını engeller.
    """
    # Blok yorumları (iç içe olmayan basit form)
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    # Satır yorumları
    sql = re.sub(r"--[^\n]*", " ", sql)
    return sql


def _strip_string_literals(sql: str) -> str:
    """
    'string' literallerini yer tutucuyla değiştirir; böylece bir string
    içindeki 'delete' gibi kelimeler yanlış pozitif üretmez. Yalnızca
    ANAHTAR KELİME taraması için kullanılır — çalıştırılacak SQL bu değildir.
    """
    return re.sub(r"'(?:[^']|'')*'", "''", sql)


def validate_select_only(raw_sql: str, *, max_rows: int = 5000) -> SafeQuery:
    """
    Ham SQL'i doğrular. Geçerse limit uygulanmış SafeQuery döner,
    geçmezse QueryValidationError fırlatır.

    Kontroller (fail-closed):
      1. Boş değil.
      2. Tek ifade — yorum ve string temizlendikten sonra gövdede ';' yok
         (stacked query engeli).
      3. SELECT veya WITH ile başlıyor.
      4. Yazma/DDL/prosedür anahtar kelimesi içermiyor.
      5. Satır limiti sarmalama ile zorlanır.
    """
    if not raw_sql or not raw_sql.strip():
        raise QueryValidationError("Boş sorgu gönderilemez.")

    original = raw_sql.strip()

    # Kontrol için temizlenmiş kopya (yorumlar + string'ler çıkarılmış)
    scan = _strip_comments(original)
    scan_no_str = _strip_string_literals(scan)

    # 2) Stacked query engeli: sondaki tek ';' hariç gövdede ';' olmamalı.
    body = scan_no_str.rstrip().rstrip(";")
    if ";" in body:
        raise QueryValidationError(
            "Birden fazla ifade veya ';' içeren sorgulara izin verilmiyor. "
            "Yalnızca tek bir SELECT ifadesi gönderin."
        )

    # 3) Başlangıç kontrolü
    if not _ALLOWED_START_RE.match(scan):
        raise QueryValidationError(
            "Yalnızca SELECT (veya WITH ... SELECT) sorgularına izin verilir."
        )

    # 4) Yasaklı anahtar kelimeler
    match = _FORBIDDEN_RE.search(scan_no_str)
    if match:
        raise QueryValidationError(
            f"Sorguda izin verilmeyen ifade tespit edildi: "
            f"'{match.group(1).upper()}'. Yalnızca okuma amaçlı SELECT "
            f"sorgularına izin verilir."
        )

    # 5) Satır limiti: doğrulanmış sorguyu bir alt sorgu olarak sarıp
    #    TOP ile sınırla.
    #
    #    Sarmalarken YORUMLARDAN ARINDIRILMIŞ sürümü kullanırız. Aksi halde
    #    sorgunun sonundaki bir '-- yorum' bizim eklediğimiz ') AS _guarded_q'
    #    satırını yorum içine düşürüp sorguyu bozabilir. String literalleri
    #    KORUNUR (yalnızca 'scan', anahtar kelime taraması için string'siz).
    executable = _strip_comments(original).strip().rstrip(";").strip()
    if not executable:
        raise QueryValidationError("Sorgu yalnızca yorumdan oluşamaz.")

    # Yorumlar çıktıktan sonra hâlâ SELECT/WITH ile başlamalı (çift kontrol).
    if not _ALLOWED_START_RE.match(executable):
        raise QueryValidationError(
            "Yalnızca SELECT (veya WITH ... SELECT) sorgularına izin verilir."
        )

    limited = (
        f"SELECT TOP ({int(max_rows)}) * FROM (\n"
        f"{executable}\n"
        f") AS _guarded_q"
    )

    return SafeQuery(sql=limited, row_limit=int(max_rows))
