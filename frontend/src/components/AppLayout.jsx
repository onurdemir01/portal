import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Page,
  PageSidebar,
  PageSidebarBody,
  Masthead,
  MastheadMain,
  MastheadBrand,
  Nav,
  NavList,
  NavItem,
  Divider,
} from '@patternfly/react-core';
import { api } from '../api';

// OpenShift konsolu gibi: sol dikey navigasyon + en altta giriş yapan kullanıcı.
// Menü öğeleri feature-flag'e göre filtrelenir; admin her şeyi görür.

const ALL_ITEMS = [
  { to: '/anasayfa', label: 'Anasayfa', key: 'anasayfa' },
  { to: '/nobetciler', label: 'Nöbetçiler', key: 'nobetciler' },
  { to: '/envanterler', label: 'Envanterler', key: 'envanterler' },
  { to: '/self-servis', label: 'Self-Servis Hizmetler', key: 'self_servis' },
];

export function AppLayout({ user, flags, brandingHasLogo, children }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const visibleItems = ALL_ITEMS.filter((item) => {
    if (user?.is_admin) return true;
    const flag = flags?.[item.key];
    return flag ? flag.public_enabled : true;
  });

  const onLogout = async () => {
    await api.logout();
    navigate('/login');
  };

  const sidebar = (
    <PageSidebar>
      <PageSidebarBody style={{
        display: 'flex', flexDirection: 'column', height: '100%',
      }}>
        {/* Menü öğeleri */}
        <Nav aria-label="Ana menü" style={{ flex: '1 1 auto' }}>
          <NavList>
            {visibleItems.map((item) => (
              <NavItem
                key={item.key}
                itemId={item.key}
                component={({ className }) => (
                  <NavLink to={item.to} className={className}>
                    {item.label}
                  </NavLink>
                )}
              />
            ))}
            {user?.is_admin && (
              <NavItem
                itemId="admin"
                component={({ className }) => (
                  <NavLink to="/admin" className={className}>
                    Admin Paneli
                  </NavLink>
                )}
              />
            )}
          </NavList>
        </Nav>

        {/* En altta: giriş yapan kullanıcı + menü */}
        <div style={{ flex: '0 0 auto', marginTop: 'auto' }}>
          <Divider />
          <div style={{ position: 'relative', padding: '12px 16px' }}>
            {menuOpen && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 12, right: 12,
                background: 'var(--pf-v5-global--BackgroundColor--100)',
                border: '1px solid var(--pf-v5-global--BorderColor--100)',
                borderRadius: 4, boxShadow: 'var(--pf-v5-global--BoxShadow--md)',
                marginBottom: 4, zIndex: 100,
              }}>
                <button
                  onClick={onLogout}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: 14, color: 'var(--pf-v5-global--Color--100)',
                  }}
                >
                  Çıkış yap
                </button>
              </div>
            )}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '6px 8px', border: 'none', background: 'none',
                cursor: 'pointer', borderRadius: 4, textAlign: 'left',
                color: 'var(--pf-v5-global--Color--100)',
              }}
            >
              <span style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'var(--pf-v5-global--primary-color--100)',
                color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 600, fontSize: 14,
              }}>
                {(user?.display_name || user?.username || '?').charAt(0).toUpperCase()}
              </span>
              <span style={{ overflow: 'hidden' }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.display_name || user?.username}
                </span>
                <span style={{ display: 'block', fontSize: 12,
                  color: 'var(--pf-v5-global--Color--200)' }}>
                  {user?.is_admin ? 'Admin' : 'Kullanıcı'} · ▾
                </span>
              </span>
            </button>
          </div>
        </div>
      </PageSidebarBody>
    </PageSidebar>
  );

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {brandingHasLogo && (
              <img
                src="/api/branding/logo"
                alt="Logo"
                style={{ height: 32, maxWidth: 160, objectFit: 'contain' }}
              />
            )}
            <span>Middleware Portal</span>
          </div>
        </MastheadBrand>
      </MastheadMain>
    </Masthead>
  );

  return (
    <Page masthead={masthead} sidebar={sidebar}>
      {children}
    </Page>
  );
}
