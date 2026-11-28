import { useEffect } from 'react';

/**
 * Tracks mobile virtual keyboard height via window.visualViewport into CSS variable `--lm-kb-offset`,
 * tracks visual viewport height into `--lm-vv-h`, and exposes `data-kb-open` / `data-kb-focus`
 * so ONLY the active writing/search bar floats smoothly above the mobile keyboard without layout jumps!
 */
export function useMobileKeyboardInset() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--lm-kb-offset', '0px');
    root.style.setProperty('--lm-vv-h', '100dvh');
    root.dataset.kbOpen = '0';
    root.dataset.kbFocus = '0';

    const vv = window.visualViewport;
    let rafId = 0;
    let blurTimer = 0;
    const sweepTimers: number[] = [];

    const isEditableTarget = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      if (node.tagName === 'TEXTAREA') return true;
      if (node.tagName === 'INPUT') {
        const type = ((node as HTMLInputElement).type || 'text').toLowerCase();
        return !['checkbox', 'radio', 'file', 'button', 'submit', 'range', 'color'].includes(type);
      }
      return Boolean(node.isContentEditable);
    };

    const sync = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const layoutH = document.documentElement.clientHeight || window.innerHeight;
        if (vv) {
          const kbHeight = Math.max(0, Math.round(layoutH - (vv.height + vv.offsetTop)));
          const effectiveKb = kbHeight >= 60 ? kbHeight : 0;
          root.style.setProperty('--lm-kb-offset', `${effectiveKb}px`);
          root.style.setProperty('--lm-vv-h', `${Math.round(vv.height)}px`);
          root.dataset.kbOpen = effectiveKb > 0 ? '1' : '0';
          if (effectiveKb > 0 && window.scrollY !== 0) {
            window.scrollTo(0, 0);
          }
        } else {
          root.style.setProperty('--lm-kb-offset', '0px');
          root.style.setProperty('--lm-vv-h', `${layoutH}px`);
          root.dataset.kbOpen = '0';
        }
      });
    };

    const clearSweeps = () => {
      while (sweepTimers.length) {
        const t = sweepTimers.pop();
        if (t) window.clearTimeout(t);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (blurTimer) {
        window.clearTimeout(blurTimer);
        blurTimer = 0;
      }
      if (isEditableTarget(e.target)) {
        root.dataset.kbFocus = '1';
      }
      sync();
      clearSweeps();
      for (const delay of [60, 150, 280, 460]) {
        sweepTimers.push(window.setTimeout(sync, delay));
      }
    };

    const onFocusOut = () => {
      if (blurTimer) window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        if (!isEditableTarget(document.activeElement)) {
          root.dataset.kbFocus = '0';
        }
        sync();
      }, 140);
    };

    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', () => {
      sync();
      sweepTimers.push(window.setTimeout(sync, 250));
    });
    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('focusout', onFocusOut, true);
    sync();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (blurTimer) window.clearTimeout(blurTimer);
      clearSweeps();
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('focusout', onFocusOut, true);
      root.style.setProperty('--lm-kb-offset', '0px');
      root.style.setProperty('--lm-vv-h', '100dvh');
      root.dataset.kbOpen = '0';
      root.dataset.kbFocus = '0';
    };
  }, []);
}
