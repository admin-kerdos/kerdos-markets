import local from "../../app/data/markets.local.json";
import devnet from "../../app/data/markets.devnet.json";

export type HistoryPoint = { t: number; yes: number; no: number };

export type UiMarketOption = {
  name: string;
  yesMint: string;
  noMint: string;
  probability?: number | null;
};

export type UiMarket = {
  slug: string;
  title: string;
  summary?: string;
  rules: string[];
  live?: "yes" | "no" | boolean;
  resolvesAt?: string;
  image?: string;
  yesMint?: string;
  noMint?: string;
  quoteMint: string;
  tickSize: number;
  minBaseQty: number;
  feesBps: number;
  multiOption?: boolean;
  options?: UiMarketOption[];
  history?: HistoryPoint[];
};

type MarketsFile = { markets: UiMarket[] };

const SOURCE: MarketsFile =
  (process.env.NEXT_PUBLIC_NETWORK ?? "local") === "devnet"
    ? (devnet as MarketsFile)
    : (local as MarketsFile);

export function getMarkets(): UiMarket[] {
  return Array.isArray(SOURCE.markets) ? [...SOURCE.markets] : [];
}

export function getMarketBySlug(slug: string): UiMarket | undefined {
  return getMarkets().find((market) => market.slug === slug);
}

export function seeded(market: UiMarket): boolean {
  if (market.multiOption && Array.isArray(market.options) && market.options.length > 0) {
    return market.options.every((option) => option.yesMint && option.noMint) && Boolean(market.quoteMint);
  }
  if (typeof market.live === "string") {
    return market.live.toLowerCase() === "yes";
  }
  if (typeof market.live === "boolean") {
    return market.live;
  }
  return [market.yesMint, market.noMint, market.quoteMint].every(Boolean);
}

export function ensureHistory(market: UiMarket): UiMarket {
  const history =
    Array.isArray(market.history) && market.history.length > 0
      ? market.history
      : generateHistory(market.slug);
  return { ...market, history };
}

function generateHistory(slug: string): HistoryPoint[] {
  const now = Date.now();
  const points: HistoryPoint[] = [];
  let current = 0.5;

  for (let i = 23; i >= 0; i -= 1) {
    const t = now - i * 60 * 60 * 1000;
    const drift = pseudoRandom(slug, i) * 0.2 - 0.1;
    current = clamp(current + drift * 0.2, 0.05, 0.95);
    const yes = clamp(current, 0.05, 0.95);
    const no = clamp(1 - yes, 0.05, 0.95);
    points.push({ t, yes, no });
  }

  return points;
}

function pseudoRandom(seed: string, iteration: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1_000_000;
  }
  const value = Math.sin(hash + iteration * 17.17) * 10000;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isMultiOptionMarket(market: UiMarket): market is UiMarket & { options: UiMarketOption[] } {
  return Boolean(market.multiOption) && Array.isArray(market.options) && market.options.length > 0;
}

export function sortMarketOptions(options: UiMarketOption[] | undefined): UiMarketOption[] {
  if (!Array.isArray(options)) {
    return [];
  }
  const hasProbabilities = options.some(
    (option) => typeof option.probability === "number" && !Number.isNaN(option.probability)
  );
  const sorted = [...options];
  sorted.sort((a, b) => {
    const aProb =
      typeof a.probability === "number" && !Number.isNaN(a.probability) ? a.probability : null;
    const bProb =
      typeof b.probability === "number" && !Number.isNaN(b.probability) ? b.probability : null;
    if (hasProbabilities) {
      if (aProb === bProb) {
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
      }
      return (bProb ?? -Infinity) - (aProb ?? -Infinity);
    }
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
  return sorted;
}

export function getTopMarketOptions(market: UiMarket, limit: number): UiMarketOption[] {
  if (limit <= 0) {
    return [];
  }
  return sortMarketOptions(market.options).slice(0, limit);
}

export function clampProbability(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  return clamp(value, 0, 1);
}
