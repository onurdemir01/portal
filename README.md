# Nöbetçi & Envanter Portalı

FastAPI (backend) + React/PatternFly (frontend) ile, OpenShift konsolu
estetiğinde bir iç portal. LDAP ile giriş, feature-flag'li public görünürlük,
envanter tabloları + güvenli özel sorgu, ve Ansible tabanlı self-servis
hizmetler (iskelet).

## Mimari

```
Nginx (TLS termination, /api -> backend, / -> frontend build)
  ├── FastAPI backend (uvicorn)        app/
  │     ├── LDAP auth (sAMAccountName + admin grup üyeliği)
  │     ├── Nöbetçiler servisi (dış API + cache)
  │     ├── Envanter servisi (SQL Server, SELECT-only guard, CSV)
  │     └── Uygulama DB (feature-flag, tablo eşlemeleri, audit)
  └── React + PatternFly frontend      frontend/
        ├── Sol menü: Nöbetçiler / Envanterler / Self-Servis
        ├── Admin: modül ve tablo görünürlüğü + görünen adlar
        └── Envanter: kolon aç/kapa, sıralama, custom query, CSV indir
```

## Güvenlik notları (ÖNEMLİ)

- **Kimlik bilgileri koda gömülü değildir.** Tümü ortam değişkeninden okunur.
  `backend/.env.example` dosyasını `.env` olarak kopyalayıp doldurun.
  `.env` **asla** git'e commit edilmez (`.gitignore`'da).
- **Chat üzerinden paylaşılan tüm parolaları rotate edin.** LDAP servis
  hesabı ve SQL Server kullanıcısı parolaları bir sohbette geçtiyse, güvenlik
  gereği yenileriyle değiştirilmelidir.
- **Custom Query yalnızca SELECT'tir.** `app/security/query_guard.py`
  birden çok katmanla doğrular: tek ifade (stacked query engeli), SELECT/WITH
  ile başlama zorunluluğu, yorum temizleme, yazma/DDL/prosedür anahtar
  kelimelerinin reddi, statement timeout ve satır limiti.
  **En güçlü koruma yine de read-only bir DB kullanıcısıdır** (`db_datareader`).
  Envanter DB kullanıcısı tam yetkiliyse, prod'a çıkmadan önce read-only bir
  kullanıcı açıp `INVENTORY_ODBC_DSN`'i onunla güncellemeniz önerilir:
  ```sql
  CREATE LOGIN TBMWANS_ro WITH PASSWORD = '<güçlü-şifre>';
  USE TBMWANS;
  CREATE USER TBMWANS_ro FOR LOGIN TBMWANS_ro;
  ALTER ROLE db_datareader ADD MEMBER TBMWANS_ro;
  ```
- Oturum cookie'si `HttpOnly + Secure + SameSite=Lax`. Nginx TLS'i termine
  eder; uygulama HTTPS expose etmez.

## Backend çalıştırma

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # pyodbc için sistemde ODBC Driver 18 gerekir
cp .env.example .env                      # değerleri doldurun
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> pyodbc için işletim sisteminde **ODBC Driver 18 for SQL Server** kurulu
> olmalıdır (msodbcsql18).

## Frontend çalıştırma

```bash
cd frontend
npm install
npm run dev        # geliştirme (Vite, /api -> localhost:8000 proxy)
npm run build      # prod build -> dist/  (Nginx bu dizini sunar)
```

## Yapılacaklar / sonraki adımlar

- **Self-Servis (Ansible):** `ANSIBLE_BASE_URL`, token ve job template
  bilgileri verildiğinde `app/services/` altına Ansible servis katmanı, job
  poll + çıktı okuma ve dosya indirme (path-traversal korumalı) eklenecek.
  Frontend'de her hizmet için ikiye bölünmüş ekran iskeleti hazır
  (`SelfServisPage.jsx`).
- **Admin paneli:** feature-flag ve tablo görünen adı düzenleme uçları
  (`/admin/*`) ve React ekranı.
- **Nested LDAP grup** çözümü gerekiyorsa `LDAP_MATCHING_RULE_IN_CHAIN`
  ile ek arama.
- **Audit log** yazımının custom query ve self-servis tetiklemelerine
  bağlanması.
```
