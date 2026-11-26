import { useEffect } from 'react';

/**
 * Tracks mobile virtual keyboard height via window.visualViewport into CSS variable `--lm-kb-offset`.
 * Combined with `interactive-widget=overlays-content`, this keeps the entire app rock-solid in place
 * while ONLY floating composer pills glide smoothly above the keyboard!
 */
export function useMobileKeyboardInset() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--lm-kb-offset', '0px');

    const vv = window.visualViewport;
    if (!vv) return;

    let rafId = 0;
    const sync = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const kbHeight = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        // Ignore tiny browser toolbar resizes (< 90px); treat >= 90px as an active soft keyboard
        const effectiveKb = kbHeight >= 90 ? kbHeight : 0;
        root.style.setProperty('--lm-kb-offset', `${effectiveKb}px`);
        // Keep root scroll locked at 0 so iOS Safari never pans the whole website upward!
        if (effectiveKb > 0 && window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      });
    };

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('orientationchange', sync);
    sync();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      window.removeEventListener('orientationchange', sync);
      root.style.setProperty('--lm-kb-offset', '0px');
    };
  }, []);
}
