import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { TodosPage } from './Todos';
import { TodoDetailPage } from './TodoDetail';
import { TodoFormPage } from './TodoForm';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="todos" element={<TodosPage />} />
      <Route path="todos/:id" element={<TodoDetailPage />} />
      <Route path="todos/:id/edit" element={<TodoFormPage />} />
    </Route>
  </Route>
);
