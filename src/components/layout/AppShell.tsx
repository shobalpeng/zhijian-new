import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

/** 移动端优先的应用外壳：内容区 + 底部导航（整页表单里隐藏，与 V1 一致） */
export function AppShell() {
  const location = useLocation();
  // /xxx/new、/xxx/:id/edit 这类整页表单靠顶部「← 返回」退出，不需要底部导航
  const isFormPage = /\/(new|edit)$/.test(location.pathname);

  // 非表单页要让出底部导航（h-16 = 5rem）+ 全面屏安全区，否则内容会被 Home Indicator 区域压住
  const bottomPad = isFormPage ? 'pb-8' : 'pb-[calc(5rem_+_env(safe-area-inset-bottom))]';

  /**
   * 切路由回到顶部。
   * React Router 不管滚动，body 的 scrollY 会原样保留 —— 在长列表滚到中部点进详情再返回，
   * 会落在列表中间。useLayoutEffect 在浏览器绘制前执行，不会看到闪一下。
   * 同时这也是吸顶页头「大标题收缩」能判对状态的前提。
   */
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    /* dvh：iOS Safari 地址栏收缩时 100vh 会算错，内容底部被切掉 */
    <div className="min-h-dvh bg-background">
      {/* key=pathname：路由切换时重放淡入动画（只认 pathname，?new=1 这类 query 变化不重挂载） */}
      <main
        key={location.pathname}
        className={`animate-page-in motion-reduce:animate-none mx-auto w-full max-w-lg px-4 pt-4 ${bottomPad}`}
      >
        <Outlet />
      </main>
      {!isFormPage && <BottomNav />}
    </div>
  );
}
