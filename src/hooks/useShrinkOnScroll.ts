'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { clamp, computeShrinkScale, easeOutCubic } from "./shrinkOnScrollMath";

type UseShrinkOnScrollOptions = {
  /**
   * Minimum scale to clamp to once the scroll threshold is reached.
   */
  minScale?: number;
  /**
   * Maximum scale used at the top of the page.
   */
  maxScale?: number;
  /**
   * Scroll distance (in pixels) required to reach the minimum scale.
   */
  distance?: number;
  /**
   * Scroll offset (in pixels) before the scale starts decreasing.
   */
  startAt?: number;
  /**
   * Custom easing function applied to the scroll progress (0..1).
   */
  easing?: (progress: number) => number;
};

type UseShrinkOnScrollResult = {
  ref: React.MutableRefObject<HTMLElement | null>;
  style: React.CSSProperties;
  scale: number;
};

export function useShrinkOnScroll(options: UseShrinkOnScrollOptions = {}): UseShrinkOnScrollResult {
  const {
    minScale = 0.8,
    maxScale = 1,
    distance = 240,
    startAt = 0,
    easing = easeOutCubic
  } = options;

  const ref = useRef<HTMLElement | null>(null);
  const [scale, setScale] = useState(() => clamp(maxScale, minScale, maxScale));
  const latestOptions = useRef({ minScale, maxScale, distance, startAt, easing });

  useEffect(() => {
    latestOptions.current = { minScale, maxScale, distance, startAt, easing };
  }, [minScale, maxScale, distance, startAt, easing]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame: number | null = null;

    const applyScale = () => {
      frame = null;
      const rawScroll = window.scrollY ?? window.pageYOffset ?? 0;
      const next = computeShrinkScale(rawScroll, latestOptions.current);
      setScale((current) => (Math.abs(current - next) < 0.001 ? current : next));
    };

    const handleScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(applyScale);
    };

    applyScale();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const formattedScale = useMemo(() => Number(scale.toFixed(3)), [scale]);

  const style = useMemo<React.CSSProperties>(
    () => ({
      transform: `scale(${formattedScale})`,
      transformOrigin: "top left",
      transition: "transform 160ms ease-out",
      willChange: "transform"
    }),
    [formattedScale]
  );

  return { ref, style, scale: formattedScale };
}

export default useShrinkOnScroll;
