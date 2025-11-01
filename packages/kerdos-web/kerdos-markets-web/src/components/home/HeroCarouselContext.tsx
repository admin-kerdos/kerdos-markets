"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UiMarket } from "@/lib/markets";
import { createHeroSegments, type HeroSegment } from "./hero-segments";

type HeroCarouselContextValue = {
  segments: HeroSegment[];
  activeId: string;
  setActiveId: (id: string) => void;
};

const HeroCarouselContext = createContext<HeroCarouselContextValue | null>(null);

type ProviderProps = {
  markets: UiMarket[];
  children: ReactNode;
};

export function HeroCarouselProvider({ markets, children }: ProviderProps) {
  const segments = useMemo(() => createHeroSegments(markets), [markets]);
  const [activeId, setActiveId] = useState<string>(segments[0]?.id ?? "");

  useEffect(() => {
    if (segments.length === 0) return;
    setActiveId((current) => {
      if (segments.some((segment) => segment.id === current)) return current;
      return segments[0].id;
    });
  }, [segments]);

  const value = useMemo<HeroCarouselContextValue>(
    () => ({
      segments,
      activeId,
      setActiveId
    }),
    [segments, activeId]
  );

  return <HeroCarouselContext.Provider value={value}>{children}</HeroCarouselContext.Provider>;
}

export function useHeroCarouselContext(): HeroCarouselContextValue | null {
  return useContext(HeroCarouselContext);
}
