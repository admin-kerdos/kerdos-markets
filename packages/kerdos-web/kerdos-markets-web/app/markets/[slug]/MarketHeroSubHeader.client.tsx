'use client';

import { useShrinkOnScroll } from "@/hooks/useShrinkOnScroll";
import type { ReactNode } from "react";

type MarketHeroSubHeaderProps = {
  className?: string;
  headerSelector?: string;
  threshold?: number;
  children: ReactNode;
  "data-testid"?: string;
};

export default function MarketHeroSubHeader({
  className,
  headerSelector = "header",
  threshold = 48,
  children,
  "data-testid": dataTestId
}: MarketHeroSubHeaderProps) {
  const rootRef = useShrinkOnScroll<HTMLDivElement>();

  return (
    <div ref={rootRef} className={className} data-market-subheader data-testid={dataTestId}>
      <div>{children}</div>
    </div>
  );
}
