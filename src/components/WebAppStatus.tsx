import { useEffect, useRef, useState } from 'react';
import type { GameController } from '../game/GameController';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

export function WebAppStatus({ controller }: { controller: GameController }) {
  const [status, setStatus] = useState<'preparing' | 'ready' | 'unavailable'>(() =>
    import.meta.env.PROD && 'serviceWorker' in navigator ? 'preparing' : 'unavailable');
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [standalone, setStandalone] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const refreshing = useRef(false);

  useEffect(() => {
    const offer = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt); };
    const installed = () => { setInstall(null); setStandalone(true); };
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let closed = false;
    let started = false;
    const cleanup: (() => void)[] = [];
    const changed = () => {
      setUpdate(null);
      if (refreshing.current) window.location.reload();
      else setStatus('ready');
    };
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    const prepare = () => {
      // Reuse the completed engine download; don't compete with the first game.
      if (started || controller.getSnapshot().phase === 'ENGINE_LOADING') return;
      started = true;
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).then(registration => {
        if (closed) return;
        const check = () => { if (!closed) setUpdate(registration.active ? registration.waiting : null); };
        const found = () => {
          const worker = registration.installing;
          if (!worker) return;
          const progress = () => {
            check();
            if (!closed && worker.state === 'redundant' && !registration.active) setStatus('unavailable');
          };
          worker.addEventListener('statechange', progress);
          cleanup.push(() => worker.removeEventListener('statechange', progress));
        };
        check();
        found();
        registration.addEventListener('updatefound', found);
        cleanup.push(() => registration.removeEventListener('updatefound', found));
        void navigator.serviceWorker.ready.then(() => { if (!closed) setStatus('ready'); });
      }).catch(() => { if (!closed) setStatus('unavailable'); });
    };
    const unsubscribe = controller.subscribe(prepare);
    prepare();
    return () => {
      closed = true;
      unsubscribe();
      cleanup.forEach(fn => fn());
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
    };
  }, [controller]);

  return <section className="web-app-status" aria-label="安装与离线使用">
    <span role="status" aria-label="离线状态">{status === 'ready' ? '已可离线使用' : status === 'preparing' ? '正在准备离线使用…' : '暂无法离线使用，可联网对弈'}</span>
    {install && !standalone && <button onClick={() => { const prompt = install; setInstall(null); void prompt.prompt().catch(() => {}); }}>安装到主屏幕</button>}
    {!install && !standalone && <small>可在浏览器菜单中添加到主屏幕</small>}
    {update && <button onClick={() => { refreshing.current = true; update.postMessage({ type: 'ACTIVATE_UPDATE' }); }}>更新版本 · 保留棋局</button>}
  </section>;
}
