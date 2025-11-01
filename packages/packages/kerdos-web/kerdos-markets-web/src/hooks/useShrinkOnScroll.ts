'use client';

import { useEffect, useMemo, useRef, useState } from "react";

type UseShrinkOnScrollOptions = {
  minScale?: number;
  maxScale?: number;
  distance?: number;
  startAt?: number;
  easing?: (progress: number) => number;
};

type UseShrinkOnScrollResult = {
  ref: React.MutableRefObject<HTMLElement | null>;
  style: React.CSSProperties;
  scale: number;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

    const computeScale = () => {
      const { minScale: min, maxScale: max, distance: totalDistance, startAt: start, easing: ease } =
        latestOptions.current;
      const rawScroll = window.scrollY ?? window.pageYOffset ?? 0;
      const offset = clamp(rawScroll - start, 0, Number.POSITIVE_INFINITY);
      const safeDistance = totalDistance <= 0 ? 1 : totalDistance;
      const progress = clamp(offset / safeDistance, 0, 1);
      const eased = clamp(ease(progress), 0, 1);
      const nextScale = clamp(max - eased * (max - min), min, max);
      return nextScale;
    };

    const applyScale = () => {
      frame = null;
      const next = computeScale();
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
