import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { AnniversariesPage } from './Anniversaries';
import { AnniversaryFormPage } from './AnniversaryForm';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="anniversaries" element={<AnniversariesPage />} />
      <Route path="anniversaries/new" element={<AnniversaryFormPage />} />
      <Route path="anniversaries/:id/edit" element={<AnniversaryFormPage />} />
    </Route>
  </Route>
);
