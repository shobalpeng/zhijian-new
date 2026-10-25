import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeSync } from '@/components/theme-sync';
import { AuthProvider } from '@/components/auth-provider';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { NotFound } from '@/pages/NotFound';
import { Toaster } from 'sonner';

/**
 * 织间自己的业务模块。pocketstack 脚手架还带了 examples / settings / menu / modules / user
 * 这些管理后台 demo 页，它们会被 import.meta.glob 一并注册成真实路由（可被直接访问），
 * 与情侣 App 无关，因此这里做白名单过滤——只注册业务模块。
 */
const APP_MODULES = new Set([
  'home',
  'tasks',
  'wishes',
  'recipes',
  'anniversaries',
  'travel',
  'wanders',
  'dines',
  'items',
  'todos',
  'me',
  'pair',
]);

const moduleRoutes = import.meta.glob('./modules/*/routes.tsx', { eager: true });

const autoRoutes = Object.entries(moduleRoutes)
  .filter(([path]) => {
    const name = path.match(/modules\/([^/]+)\//)?.[1] ?? '';
    return APP_MODULES.has(name);
  })
  .map(([, mod]: [string, any]) => mod.routes || mod.default);

export function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <Toaster position="top-center" richColors />
      <AuthProvider>
        <ThemeSync />
        <BrowserRouter>
          <Routes>
            {/* 各业务模块自带 ProtectedRoute + AppShell */}
            {autoRoutes}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
