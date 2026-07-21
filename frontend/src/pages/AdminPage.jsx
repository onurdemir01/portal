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
} from '@patternfly/react-core';
import { api } from '../api';

// Admin paneli. Şimdilik: logo/branding yönetimi.
// İleride buraya feature-flag ve tablo görünen-adı düzenleme de eklenecek.

function LogoManager({ onChange }) {
  const [hasLogo, setHasLogo] = React.useState(false);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // Cache-busting: yükleme sonrası <img>'i tazelemek için
  const [bust, setBust] = React.useState(Date.now());
  const inputRef = React.useRef(null);

  const refresh = React.useCallback(async () => {
    try {
      const s = await api.brandingStatus();
      setHasLogo(s.has_logo);
      setBust(Date.now());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const onPick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      await api.uploadLogo(f);
      await refresh();
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onRemove = async () => {
    setBusy(true);
    setError('');
    try {
      await api.deleteLogo();
      await refresh();
      onChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
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
                <img
                  src={`/api/branding/logo?t=${bust}`}
                  alt="Logo önizleme"
                  style={{ maxWidth: 88, maxHeight: 88, objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: 12, color: 'var(--pf-v5-global--Color--200)' }}>
                  Logo yok
                </span>
              )}
            </div>
          </SplitItem>
          <SplitItem isFilled>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" onClick={onPick} isDisabled={busy}>
                {hasLogo ? 'Logoyu değiştir' : 'Logo yükle'}
              </Button>
              {hasLogo && (
                <Button variant="secondary" onClick={onRemove} isDisabled={busy}>
                  Kaldır
                </Button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon"
              style={{ display: 'none' }}
              onChange={onFile}
            />
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  );
}

function PhotoManager() {
  const [registryId, setRegistryId] = React.useState('');
  const [ids, setIds] = React.useState([]);
  const [error, setError] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef(null);

  const refresh = React.useCallback(async () => {
    try {
      const r = await api.listPhotos();
      setIds(r.registry_ids || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const onPick = () => {
    setError('');
    setMsg('');
    if (!registryId.trim()) {
      setError('Önce sicil no girin.');
      return;
    }
    inputRef.current?.click();
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError('');
    try {
      await api.uploadPhoto(registryId.trim(), f);
      setMsg(`${registryId.trim()} için fotoğraf yüklendi.`);
      setRegistryId('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onRemove = async (id) => {
    setBusy(true);
    setError('');
    try {
      await api.deletePhoto(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle>Nöbetçi Fotoğrafları</CardTitle>
      <CardBody>
        <p style={{ marginBottom: 16 }}>
          Fotoğraflar sicil no (registryId) ile eşleşir ve Anasayfa'daki Asıl
          Nöbetçi kartında görünür. JPG, PNG veya WEBP — en fazla 2 MB.
        </p>

        {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 12 }} />}
        {msg && <Alert variant="success" title={msg} isInline style={{ marginBottom: 12 }} />}

        <Split hasGutter style={{ alignItems: 'flex-end', marginBottom: 16 }}>
          <SplitItem>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
              Sicil no
            </label>
            <TextInput
              value={registryId}
              onChange={(_e, v) => setRegistryId(v)}
              placeholder="örn. 722627"
              style={{ width: 180 }}
            />
          </SplitItem>
          <SplitItem>
            <Button variant="primary" onClick={onPick} isDisabled={busy}>
              Fotoğraf seç ve yükle
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={onFile}
            />
          </SplitItem>
        </Split>

        <Divider style={{ margin: '16px 0' }} />

        <div style={{ fontSize: 13, marginBottom: 8 }}>
          Yüklü fotoğraflar ({ids.length}):
        </div>
        {ids.length === 0 ? (
          <span style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: 13 }}>
            Henüz fotoğraf yüklenmemiş.
          </span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {ids.map((id) => (
              <div key={id} style={{ textAlign: 'center' }}>
                <img
                  src={`/api/photos/${encodeURIComponent(id)}`}
                  alt={id}
                  style={{
                    width: 56, height: 56, borderRadius: '50%',
                    objectFit: 'cover', display: 'block', marginBottom: 4,
                    border: '1px solid var(--pf-v5-global--BorderColor--100)',
                  }}
                />
                <div style={{ fontSize: 12 }}>{id}</div>
                <Button variant="link" isInline isDanger
                  onClick={() => onRemove(id)} style={{ fontSize: 11 }}>
                  Sil
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function AdminPage({ onBrandingChange }) {
  return (
    <PageSection>
      <Title headingLevel="h1">Yönetim</Title>
      <div style={{ marginTop: 16, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <LogoManager onChange={onBrandingChange} />
        <PhotoManager />
      </div>
    </PageSection>
  );
}
