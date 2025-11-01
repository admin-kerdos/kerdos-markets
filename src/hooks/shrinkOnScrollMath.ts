export type ShrinkConfig = {
  minScale: number;
  maxScale: number;
  distance: number;
  startAt: number;
  easing?: (progress: number) => number;
};

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function computeShrinkScale(scrollY: number, config: ShrinkConfig): number {
  const { minScale, maxScale, distance, startAt, easing = easeOutCubic } = config;
  const offset = clamp(scrollY - startAt, 0, Number.POSITIVE_INFINITY);
  const safeDistance = distance <= 0 ? 1 : distance;
  const progress = clamp(offset / safeDistance, 0, 1);
  const eased = clamp(easing(progress), 0, 1);
  const nextScale = clamp(maxScale - eased * (maxScale - minScale), minScale, maxScale);
  return Number(nextScale.toFixed(3));
}
