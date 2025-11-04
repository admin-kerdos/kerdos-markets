// @ts-nocheck

import {
  clampProbability,
  getMarkets,
  getTopMarketOptions,
  isMultiOptionMarket,
  sortMarketOptions
} from "@/lib/markets";

describe("multi-option market helpers", () => {
  const markets = getMarkets();
  const multi = markets.find((market) => market.slug === "cr-elecciones-ganador-2026");
  const single = markets.find((market) => market.slug === "sol-ath-2025");

  test("detects multi-option configuration and exposes all candidates", () => {
    expect(multi).toBeDefined();
    if (!multi) return;
    expect(isMultiOptionMarket(multi)).toBe(true);
    expect(Array.isArray(multi.options)).toBe(true);
    expect(multi.options).toHaveLength(3);
  });

  test("sortMarketOptions ranks by probability descending", () => {
    if (!multi || !multi.options) {
      throw new Error("Expected multi-option market with options");
    }
    const sorted = sortMarketOptions(multi.options);
    expect(sorted.map((option) => option.name)).toEqual([
      "Laura Fernández",
      "Juan Carlos Hidalgo",
      "Álvaro Ramos"
    ]);
  });

  test("sortMarketOptions falls back to alphabetical when no probabilities exist", () => {
    if (!multi || !multi.options) {
      throw new Error("Expected multi-option market with options");
    }
    const withoutProbabilities = multi.options.map((option) => ({
      ...option,
      probability: undefined
    }));
    const sorted = sortMarketOptions(withoutProbabilities);
    expect(sorted.map((option) => option.name)).toEqual([
      "Álvaro Ramos",
      "Juan Carlos Hidalgo",
      "Laura Fernández"
    ]);
  });

  test("getTopMarketOptions returns the top two candidates", () => {
    if (!multi) {
      throw new Error("Expected multi-option market");
    }
    const topTwo = getTopMarketOptions(multi, 2);
    expect(topTwo).toHaveLength(2);
    expect(topTwo.map((option) => option.name)).toEqual([
      "Laura Fernández",
      "Juan Carlos Hidalgo"
    ]);
  });

  test("single-option markets bypass multi-option helpers", () => {
    expect(single).toBeDefined();
    if (!single) return;
    expect(isMultiOptionMarket(single)).toBe(false);
    expect(sortMarketOptions(single.options)).toEqual([]);
    expect(getTopMarketOptions(single, 2)).toEqual([]);
  });

  test("clampProbability keeps values within the 0-1 interval", () => {
    expect(clampProbability(1.4)).toBe(1);
    expect(clampProbability(-0.2)).toBe(0);
    expect(clampProbability(undefined)).toBeNull();
  });
});
