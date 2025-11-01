'use client';

import type { CSSProperties, PropsWithChildren } from "react";
import useShrinkOnScroll from "@/hooks/useShrinkOnScroll";
import { cn } from "@/lib/utils";

type Props = PropsWithChildren<{
  className?: string;
  minScale?: number;
  distance?: number;
  startAt?: number;
  stickyTop?: string;
  "data-testid"?: string;
}>;

export default function MarketHeroIdentity({
  className,
  minScale = 0.8,
  distance = 240,
  startAt = 0,
  stickyTop = "clamp(var(--space-5), 5vw, var(--space-7))",
  children,
  "data-testid": dataTestId
}: Props) {
  const { ref, style } = useShrinkOnScroll({ minScale, distance, startAt });

  const mergedStyle: CSSProperties = {
    ...style,
    ...(stickyTop ? { ["--hero-sticky-top" as const]: stickyTop } : {})
  };

  return (
    <div ref={ref} className={cn(className)} style={mergedStyle} data-testid={dataTestId}>
      {children}
    </div>
  );
}
