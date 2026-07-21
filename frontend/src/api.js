// Basit fetch tabanlı API istemcisi. Oturum cookie ile taşınır (credentials).

async function req(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch { /* ignore */ }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const api = {
  me: () => req('/api/auth/me'),
  login: (username, password) =>
    req('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => req('/api/auth/logout', { method: 'POST' }),

  nobetciCurrent: () => req('/api/nobetciler/current'),
  nobetciSchedule: () => req('/api/nobetciler/schedule'),
  weather: () => req('/api/weather'),

  inventoryColumns: (table) => req(`/api/inventory/${table}/columns`),
  inventoryQuery: (table, body) =>
    req(`/api/inventory/${table}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  customQuery: (sql) =>
    req('/api/inventory/custom-query', {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }),
  // CSV indirmesi ayrı — blob olarak alınır
  customQueryCsvUrl: '/api/inventory/custom-query/csv',

  brandingStatus: () => req('/api/branding/status'),
  uploadLogo: async (fileObj) => {
    const fd = new FormData();
    fd.append('file', fileObj);
    const res = await fetch('/api/branding/logo', {
      method: 'POST',
      credentials: 'include',
      body: fd, // Content-Type'ı tarayıcı otomatik ayarlar (multipart boundary)
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try { detail = (await res.json()).detail || detail; } catch {}
      throw new Error(detail);
    }
    return res.json();
  },
  deleteLogo: () => req('/api/branding/logo', { method: 'DELETE' }),
};
