import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { InteractiveFormPage } from '@/components/interactive/interactive-form';
import { InteractiveDetailPage } from '@/components/interactive/interactive-detail';
import { TasksPage } from './Tasks';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="tasks" element={<TasksPage />} />
      <Route path="tasks/new" element={<InteractiveFormPage kind="tasks" />} />
      <Route path="tasks/:id" element={<InteractiveDetailPage kind="tasks" />} />
      <Route path="tasks/:id/edit" element={<InteractiveFormPage kind="tasks" />} />
    </Route>
  </Route>
);
