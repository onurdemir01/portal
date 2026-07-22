import React from 'react';
import {
  PageSection,
  Title,
  Card,
  CardTitle,
  CardBody,
  Button,
  Alert,
  Split,
  SplitItem,
  Divider,
  TextInput,
  Switch,
} from '@patternfly/react-core';
import { api } from '../api';

// --- Logo yönetimi ---
function LogoManager({ onChange }) {
  const [hasLogo, setHasLogo] = React.useState(false);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [bust, setBust] = React.useState(Date.now());
  const inputRef = React.useRef(null);

  const refresh = React.useCallback(async () => {
    try {
      const s = await api.brandingStatus();
      setHasLogo(s.has_logo);
      setBust(Date.now());
    } catch (err) { setError(err.message); }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const onPick = () => inputRef.current?.click();
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(''); setBusy(true);
    try {
      await api.uploadLogo(f);
      await refresh();
      onChange?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const onRemove = async () => {
    setBusy(true); setError('');
    try { await api.deleteLogo(); await refresh(); onChange?.(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardTitle>Logo / Amblem</CardTitle>
      <CardBody>
        <p style={{ marginBottom: 16 }}>
          Yüklediğiniz logo sol üst köşede ve tarayıcı sekmesinde (favicon)
          görünür. PNG, SVG, JPG, WEBP veya ICO — en fazla 2 MB.
        </p>
        {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />}
        <Split hasGutter style={{ alignItems: 'center' }}>
          <SplitItem>
            <div style={{
              width: 96, height: 96, border: '1px dashed var(--pf-v5-global--BorderColor--100)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--pf-v5-global--BackgroundColor--200)', borderRadius: 4,
            }}>
              {hasLogo ? (
                <img src={`/api/branding/logo?t=${bust}`} alt="Logo önizleme"
                  style={{ maxWidth: 88, maxHeight: 88, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 12, color: 'var(--pf-v5-global--Color--200)' }}>Logo yok</span>
              )}
            </div>
          </SplitItem>
          <SplitItem isFilled>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" onClick={onPick} isDisabled={busy}>
                {hasLogo ? 'Logoyu değiştir' : 'Logo yükle'}
              </Button>
              {hasLogo && <Button variant="secondary" onClick={onRemove} isDisabled={busy}>Kaldır</Button>}
            </div>
            <input ref={inputRef} type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon"
              style={{ display: 'none' }} onChange={onFile} />
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  );
}

// --- Modül görünürlüğü (feature flag) ---
function FlagManager({ onChange }) {
  const [flags, setFlags] = React.useState({});
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState('');

  const refresh = React.useCallback(async () => {
    try { const r = await api.getFlags(); setFlags(r.flags || {}); }
    catch (err) { setError(err.message); }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (key, value) => {
    setBusy(key); setError('');
    try {
      const r = await api.setFlag(key, value);
      setFlags(r.flags || {});
      onChange?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  return (
    <Card>
      <CardTitle>Ekran Görünürlüğü</CardTitle>
      <CardBody>
        <p style={{ marginBottom: 16 }}>
          Kapatılan ekranlar, admin olmayan kullanıcıların menüsünde görünmez.
          Adminler her ekranı her zaman görür.
        </p>
        {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(flags).map(([key, info]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{info.label}</span>
              <Switch
                id={`flag-${key}`}
                label="Açık"
                labelOff="Kapalı"
                isChecked={info.public_enabled}
                onChange={(_e, v) => toggle(key, v)}
                isDisabled={busy === key}
              />
            </div>
          ))}
          {Object.keys(flags).length === 0 && (
            <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: 13 }}>
              Yükleniyor…
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// --- Nöbetçi fotoğrafları (e-posta bazlı) ---
function PhotoManager() {
  const [email, setEmail] = React.useState('');
  const [keys, setKeys] = React.useState([]);
  const [error, setError] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef(null);

  const refresh = React.useCallback(async () => {
    try { const r = await api.listPhotos(); setKeys(r.keys || []); }
    catch (err) { setError(err.message); }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const onPick = () => {
    setError(''); setMsg('');
    if (!email.trim() || !email.includes('@')) { setError('Önce geçerli bir e-posta girin.'); return; }
    inputRef.current?.click();
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setError('');
    try {
      await api.uploadPhoto(email.trim(), f);
      setMsg(`${email.trim()} için fotoğraf yüklendi.`);
      setEmail('');
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  return (
    <Card>
      <CardTitle>Nöbetçi Fotoğrafları</CardTitle>
      <CardBody>
        <p style={{ marginBottom: 16 }}>
          Fotoğraflar e-posta adresiyle eşleşir ve Anasayfa'daki Asıl Nöbetçi
          kartında görünür. JPG, PNG veya WEBP — en fazla 2 MB.
        </p>
        {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 12 }} />}
        {msg && <Alert variant="success" title={msg} isInline style={{ marginBottom: 12 }} />}
        <Split hasGutter style={{ alignItems: 'flex-end', marginBottom: 16 }}>
          <SplitItem isFilled>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>E-posta</label>
            <TextInput value={email} onChange={(_e, v) => setEmail(v)}
              placeholder="ornek@garantibbva.com.tr" style={{ maxWidth: 320 }} />
          </SplitItem>
          <SplitItem>
            <Button variant="primary" onClick={onPick} isDisabled={busy}>
              Fotoğraf seç ve yükle
            </Button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }} onChange={onFile} />
          </SplitItem>
        </Split>
        <Divider style={{ margin: '16px 0' }} />
        <div style={{ fontSize: 13, marginBottom: 8 }}>Yüklü fotoğraflar ({keys.length}):</div>
        {keys.length === 0 ? (
          <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: 13 }}>
            Henüz fotoğraf yüklenmemiş.
          </span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {keys.map((k) => (
              <div key={k} style={{ textAlign: 'center', maxWidth: 130 }}>
                <img src={`/api/photos/by-key/${encodeURIComponent(k)}`}
                  alt={k}
                  style={{
                    width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                    display: 'block', margin: '0 auto 4px',
                    border: '1px solid var(--pf-v5-global--BorderColor--100)',
                  }}
                />
                <div style={{ fontSize: 11, wordBreak: 'break-all', marginBottom: 2 }}>{k}</div>
                <Button variant="link" isInline isDanger style={{ fontSize: 11 }}
                  onClick={async () => {
                    setBusy(true); setError('');
                    try {
                      await api.deletePhotoByKey(k);
                      await refresh();
                    } catch (err) { setError(err.message); }
                    finally { setBusy(false); }
                  }}>
                  Sil
                </Button>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--pf-v5-global--Color--200)', marginTop: 12 }}>
          Not: Liste, dosya adına göre gösterilir (e-postanın güvenli hali).
        </p>
      </CardBody>
    </Card>
  );
}

export function AdminPage({ onBrandingChange, onFlagsChange }) {
  return (
    <PageSection>
      <Title headingLevel="h1">Admin Paneli</Title>
      <div style={{ marginTop: 16, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FlagManager onChange={onFlagsChange} />
        <LogoManager onChange={onBrandingChange} />
        <PhotoManager />
      </div>
    </PageSection>
  );
}
