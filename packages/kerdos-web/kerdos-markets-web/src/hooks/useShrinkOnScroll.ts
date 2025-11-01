import { useEffect, useRef } from 'react';

const MIN_SCALE = 0.8;
const MAX_SCALE = 1;
const SCROLL_THRESHOLD_START = 0;
const SCROLL_THRESHOLD_END = 200;

export function useShrinkOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const scrollEl = document.scrollingElement || document.documentElement;

    let animationFrameId: number | null = null;

    const applyScale = () => {
      const y = scrollEl.scrollTop;
      const scrollRange = SCROLL_THRESHOLD_END - SCROLL_THRESHOLD_START;
      const scrollPercent =
        (y - SCROLL_THRESHOLD_START) / scrollRange;

      const scale = MAX_SCALE - (MAX_SCALE - MIN_SCALE) * scrollPercent;
      const finalScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

      el.style.transform = `scale(${finalScale})`;
      el.style.transformOrigin = 'center top';

      animationFrameId = null;
    };

    const scheduleScaleUpdate = () => {
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(applyScale);
      }
    };

    window.addEventListener('scroll', scheduleScaleUpdate, { passive: true });
    scheduleScaleUpdate();

    return () => {
      window.removeEventListener('scroll', scheduleScaleUpdate);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return ref;
}
