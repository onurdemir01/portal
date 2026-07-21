import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spinner, Bullseye } from '@patternfly/react-core';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { NobetcilerPage } from './pages/NobetcilerPage';
import { EnvanterlerPage } from './pages/EnvanterlerPage';
import { SelfServisPage } from './pages/SelfServisPage';
import { api } from './api';

// Varsayılan envanter tabloları. Admin panelinden görünen adlar (display_name)
// değiştirilebilir; ileride bu liste /api/inventory/tables'tan yüklenecek.
const DEFAULT_TABLES = [
  { real_table: 'Inventory', display_name: 'Envanter' },
  { real_table: 'MWAppsInventory', display_name: 'MW Uygulama Envanteri' },
  { real_table: 'IPInventory', display_name: 'IP Envanteri' },
  { real_table: 'InitSriptsInventory', display_name: 'Init Script Envanteri' },
  { real_table: 'InitSriptsInventory8', display_name: 'Init Script Envanteri 8' },
  { real_table: 'BMW_Certificates', display_name: 'Sertifikalar' },
  { real_table: 'BMW_Certificates_Inventory', display_name: 'Sertifika Envanteri' },
];

export default function App() {
  const [user, setUser] = React.useState(undefined); // undefined = yükleniyor
  const location = useLocation();

  React.useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <Bullseye><Spinner /></Bullseye>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" state={{ from: location }} replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout user={user} flags={{}}>
      <Routes>
        <Route path="/" element={<Navigate to="/nobetciler" replace />} />
        <Route path="/nobetciler" element={<NobetcilerPage />} />
        <Route path="/envanterler" element={<EnvanterlerPage tables={DEFAULT_TABLES} />} />
        <Route path="/self-servis" element={<SelfServisPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
