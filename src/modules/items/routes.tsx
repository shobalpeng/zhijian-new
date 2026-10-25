import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { ItemsPage } from './Items';
import { ItemFormPage } from './ItemForm';
import { ItemDetailPage } from './ItemDetail';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="items" element={<ItemsPage />} />
      <Route path="items/new" element={<ItemFormPage />} />
      <Route path="items/:id" element={<ItemDetailPage />} />
      <Route path="items/:id/edit" element={<ItemFormPage />} />
    </Route>
  </Route>
);
