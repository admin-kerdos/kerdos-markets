'use client';

import type { PropsWithChildren } from "react";
import { useShrinkOnScroll } from "@/hooks/useShrinkOnScroll";
import { cn } from "@/lib/utils";

type Props = PropsWithChildren<{
  className?: string;
  "data-testid"?: string;
}>;

export default function MarketHeroIdentity({
  className,
  children,
  "data-testid": dataTestId
}: Props) {
  const ref = useShrinkOnScroll<HTMLDivElement>();

  return (
    <div ref={ref} className={cn(className)} data-testid={dataTestId}>
      {children}
    </div>
  );
}
