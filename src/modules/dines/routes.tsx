import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { DinesPage } from './Dines';
import { DineDetailPage } from './DineDetail';
import { DineFormPage } from './DineForm';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="dines" element={<DinesPage />} />
      {/* 静态段优先于 :id，因此 /dines/new 不会被当成详情 */}
      <Route path="dines/new" element={<DineFormPage />} />
      <Route path="dines/:id" element={<DineDetailPage />} />
      <Route path="dines/:id/edit" element={<DineFormPage />} />
    </Route>
  </Route>
);
