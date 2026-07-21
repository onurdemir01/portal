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

export function AdminPage({ onBrandingChange }) {
  return (
    <PageSection>
      <Title headingLevel="h1">Yönetim</Title>
      <div style={{ marginTop: 16, maxWidth: 640 }}>
        <LogoManager onChange={onBrandingChange} />
      </div>
    </PageSection>
  );
}
