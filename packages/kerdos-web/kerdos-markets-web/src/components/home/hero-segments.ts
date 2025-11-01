"use client";

import type { UiMarket } from "@/lib/markets";

export type HeroSegment = {
  id: string;
  label: string;
  markets: UiMarket[];
};

type SegmentDefinition = {
  id: string;
  label: string;
  filter?: (market: UiMarket) => boolean;
};

export function createHeroSegments(markets: UiMarket[]): HeroSegment[] {
  const fallback = markets.slice(0, 4);
  const definitions: SegmentDefinition[] = [
    { id: "popular", label: "Popular" },
    { id: "new", label: "Nuevo" },
    {
      id: "politics",
      label: "Política",
      filter: keywordFilter(["elecciones", "presid", "milei", "política"])
    },
    {
      id: "football",
      label: "Fútbol",
      filter: keywordFilter(["libertadores", "futbol", "fútbol", "liga"])
    },
    {
      id: "economy",
      label: "Economía",
      filter: keywordFilter(["solana", "btc", "econom", "inflación", "usd"])
    },
    {
      id: "culture",
      label: "Cultura",
      filter: keywordFilter(["festival", "premio", "cultura", "música", "serie"])
    }
  ];

  return definitions.map((definition) => {
    let matches: UiMarket[] = [];
    if (definition.id === "new") {
      matches = sortMarketsByRecency(markets).slice(0, 4);
    } else if (typeof definition.filter === "function") {
      matches = markets.filter(definition.filter);
    } else {
      matches = markets;
    }

    const selection = matches.length > 0 ? matches : fallback;
    return {
      ...definition,
      markets: selection.slice(0, 4)
    };
  });
}

function keywordFilter(keywords: string[]) {
  return (market: UiMarket) => {
    const title = market.title.toLowerCase();
    const slug = market.slug.toLowerCase();
    return keywords.some((keyword) => title.includes(keyword) || slug.includes(keyword));
  };
}

function sortMarketsByRecency(markets: UiMarket[]): UiMarket[] {
  return [...markets].sort((a, b) => {
    const aTime = a.resolvesAt ? Date.parse(a.resolvesAt) : 0;
    const bTime = b.resolvesAt ? Date.parse(b.resolvesAt) : 0;
    return bTime - aTime;
  });
}
