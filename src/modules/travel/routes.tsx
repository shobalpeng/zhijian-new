import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { TravelPage } from './Travel';
import { DestinationFormPage } from './DestinationForm';
import { DestinationDetailPage } from './DestinationDetail';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="travel" element={<TravelPage />} />
      <Route path="travel/new" element={<DestinationFormPage />} />
      <Route path="travel/:id" element={<DestinationDetailPage />} />
      <Route path="travel/:id/edit" element={<DestinationFormPage />} />
    </Route>
  </Route>
);
