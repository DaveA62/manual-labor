import type { GamePlatform } from './contracts.ts';
import { feedback } from './browserFeedback.ts';
/** Browser / future WebView host. No APIs are accessed until a service is called. */
export const browserPlatform: GamePlatform = {
  sessionId() {
    try { const key='manual-labor:window'; let id=sessionStorage.getItem(key); if(!id){id=Math.random().toString(36).slice(2);sessionStorage.setItem(key,id);}return id; }
    catch { return Math.random().toString(36).slice(2); }
  },
  storage: {
    getItem: key => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
    removeItem: key => globalThis.localStorage.removeItem(key),
  },
  lifecycle: {
    isActive: () => document.visibilityState === 'visible',
    now: () => performance.now(),
    subscribe(listener) {
      const visibility = () => listener(document.visibilityState === 'visible');
      const hide = () => listener(false);
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('pagehide', hide);
      window.addEventListener('pageshow', visibility);
      return () => {
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('pagehide', hide);
        window.removeEventListener('pageshow', visibility);
      };
    },
  },
  feedback,
};
