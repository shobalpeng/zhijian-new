import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/layout';
import { RecipesPage } from './Recipes';
import { RecipeFormPage } from './RecipeForm';

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<AppShell />}>
      <Route path="recipes" element={<RecipesPage />} />
      <Route path="recipes/new" element={<RecipeFormPage />} />
      <Route path="recipes/:id/edit" element={<RecipeFormPage />} />
    </Route>
  </Route>
);
