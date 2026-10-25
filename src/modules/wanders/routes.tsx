import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { WandersPage } from './Wanders';
import { WanderFormPage } from './WanderForm';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="wanders" element={<WandersPage />} />
      <Route path="wanders/new" element={<WanderFormPage />} />
      <Route path="wanders/:id/edit" element={<WanderFormPage />} />
    </Route>
  </Route>
);
