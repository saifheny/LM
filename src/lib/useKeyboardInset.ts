import { useEffect } from 'react';

/**
 * Tracks mobile virtual keyboard height via window.visualViewport into CSS variable `--lm-kb-offset`.
 * Keeps the entire viewport rock-solid in place while ONLY the active text composer floats cleanly above the keyboard!
 */
export function useMobileKeyboardInset() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--lm-kb-offset', '0px');

    const vv = window.visualViewport;
    if (!vv) return;

    let rafId = 0;
    let t1 = 0;
    let t2 = 0;

    const sync = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const kbHeight = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        const effectiveKb = kbHeight >= 80 ? kbHeight : 0;
        root.style.setProperty('--lm-kb-offset', `${effectiveKb}px`);
        if (effectiveKb > 0 && window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      });
    };

    const onFocusChange = () => {
      sync();
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      t1 = window.setTimeout(sync, 120);
      t2 = window.setTimeout(sync, 320);
    };

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    window.addEventListener('orientationchange', onFocusChange);
    window.addEventListener('focusin', onFocusChange, true);
    window.addEventListener('focusout', onFocusChange, true);
    sync();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      window.removeEventListener('orientationchange', onFocusChange);
      window.removeEventListener('focusin', onFocusChange, true);
      window.removeEventListener('focusout', onFocusChange, true);
      root.style.setProperty('--lm-kb-offset', '0px');
    };
  }, []);
}
