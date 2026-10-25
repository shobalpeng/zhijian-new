import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

/** 移动端优先的应用外壳：内容区 + 底部导航（整页表单里隐藏，与 V1 一致） */
export function AppShell() {
  const location = useLocation();
  // /xxx/new、/xxx/:id/edit 这类整页表单靠顶部「← 返回」退出，不需要底部导航
  const isFormPage = /\/(new|edit)$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      <main
        className={`mx-auto w-full max-w-lg px-4 pt-4 ${isFormPage ? 'pb-8' : 'pb-20'}`}
      >
        <Outlet />
      </main>
      {!isFormPage && <BottomNav />}
    </div>
  );
}
