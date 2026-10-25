import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { InteractiveFormPage } from '@/components/interactive/interactive-form';
import { InteractiveDetailPage } from '@/components/interactive/interactive-detail';
import { WishesPage } from './Wishes';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="wishes" element={<WishesPage />} />
      <Route path="wishes/new" element={<InteractiveFormPage kind="wishes" />} />
      <Route path="wishes/:id" element={<InteractiveDetailPage kind="wishes" />} />
      <Route path="wishes/:id/edit" element={<InteractiveFormPage kind="wishes" />} />
    </Route>
  </Route>
);
