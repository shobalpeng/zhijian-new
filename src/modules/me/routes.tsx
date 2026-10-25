import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { MePage } from './Me';
import { PartnerSettingsPage } from './PartnerSettings';
import { AppearanceSettingsPage } from './AppearanceSettings';
import { SecuritySettingsPage } from './SecuritySettings';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="me" element={<MePage />} />
      <Route path="me/partner" element={<PartnerSettingsPage />} />
      <Route path="me/appearance" element={<AppearanceSettingsPage />} />
      <Route path="me/security" element={<SecuritySettingsPage />} />
    </Route>
  </Route>
);
