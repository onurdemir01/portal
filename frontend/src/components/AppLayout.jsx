import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Page,
  PageSidebar,
  PageSidebarBody,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  Nav,
  NavList,
  NavItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggle,
} from '@patternfly/react-core';
import { api } from '../api';

// OpenShift konsolu gibi: koyu masthead, sol dikey navigasyon, içerik alanı.
// Menü öğeleri feature-flag'e göre filtrelenir; admin her şeyi görür.

const ALL_ITEMS = [
  { to: '/nobetciler', label: 'Nöbetçiler', key: 'nobetciler' },
  { to: '/envanterler', label: 'Envanterler', key: 'envanterler' },
  { to: '/self-servis', label: 'Self-Servis Hizmetler', key: 'self_servis' },
];

export function AppLayout({ user, flags, brandingHasLogo, children }) {
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

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
      <PageSidebarBody>
        <Nav aria-label="Ana menü">
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
                    Yönetim
                  </NavLink>
                )}
              />
            )}
          </NavList>
        </Nav>
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
      <MastheadContent>
        <Toolbar isFullHeight>
          <ToolbarContent>
            <ToolbarItem align={{ default: 'alignRight' }}>
              <Dropdown
                isOpen={userMenuOpen}
                onOpenChange={setUserMenuOpen}
                toggle={(ref) => (
                  <MenuToggle
                    ref={ref}
                    onClick={() => setUserMenuOpen((o) => !o)}
                    isExpanded={userMenuOpen}
                  >
                    {user?.display_name || user?.username}
                    {user?.is_admin ? ' (admin)' : ''}
                  </MenuToggle>
                )}
              >
                <DropdownList>
                  <DropdownItem onClick={onLogout}>Çıkış yap</DropdownItem>
                </DropdownList>
              </Dropdown>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  return (
    <Page masthead={masthead} sidebar={sidebar}>
      {children}
    </Page>
  );
}
