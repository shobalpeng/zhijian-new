import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * 底部导航「+」的统一新建入口：跳转 `模块页?new=1`，页面据此打开新建弹窗。
 * 这样不必为每个模块再建一个 /create 路由（V1 是每模块一个 create 页）。
 *
 * 打开状态 = URL 标记（外部触发）或本地状态（页面内「新增」按钮触发）；
 * 关闭时顺手把 URL 上的 ?new=1 去掉，避免后退时又弹一次。
 */
export function useNewRecord() {
  const [params, setParams] = useSearchParams();
  const [local, setLocal] = useState(false);
  const fromUrl = params.get('new') === '1';

  const setOpen = useCallback(
    (v: boolean) => {
      setLocal(v);
      if (!v && params.get('new')) {
        const next = new URLSearchParams(params);
        next.delete('new');
        setParams(next, { replace: true });
      }
    },
    [params, setParams],
  );

  return { open: fromUrl || local, setOpen };
}
