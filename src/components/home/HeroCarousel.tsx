"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { HistoryPoint, UiMarket, UiMarketOption } from "@/lib/markets";
import { clampProbability, ensureHistory, getTopMarketOptions, isMultiOptionMarket } from "@/lib/markets";
import { useTradeModal, type TradeSide } from "@/hooks/useTradeModal";
import styles from "@/styles/components/HeroCarousel.module.css";
import SearchBar from "@/components/ui/SearchBar";
import { createHeroSegments } from "./hero-segments";
import { useHeroCarouselContext } from "./HeroCarouselContext";
import TradeModal from "../../../app/markets/[slug]/TradeModal.client";

type HeroVariant = "full" | "header" | "content";

type Props = {
  markets: UiMarket[];
  brand: ReactNode;
  actions: ReactNode;
  variant?: HeroVariant;
  showDivider?: boolean;
};

export default function HeroCarousel({ markets, brand, actions, variant = "content", showDivider = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sharedContext = useHeroCarouselContext();
  const localSegments = useMemo(() => createHeroSegments(markets), [markets]);
  const segments = sharedContext?.segments ?? localSegments;
  const [localActiveId, setLocalActiveId] = useState<string>(localSegments[0]?.id ?? "");
  const activeId = sharedContext?.activeId ?? localActiveId;
  const setActiveId = sharedContext?.setActiveId ?? setLocalActiveId;
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isOpen, side, intent, open, close, setIntent, setSide } = useTradeModal();
  const [modalMarket, setModalMarket] = useState<{
    title: string;
    image: string;
    prices: {
      yes: PriceInfo;
      no: PriceInfo;
    };
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(
    () => () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    },
    []
  );

  const handleModalClose = useCallback(() => {
    close();
    setModalMarket(null);
  }, [close]);

  const handleTitleClick = useCallback(
    (href: string) => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      clickTimeoutRef.current = setTimeout(() => {
        router.push(href);
        clickTimeoutRef.current = null;
      }, 250);
    },
    [router]
  );

  const handleTradeClick = useCallback(
    (market: UiMarket, nextSide: TradeSide, option?: UiMarketOption) => {
      const detailed = ensureHistory(market);
      const prices = option ? computeOptionTradePrices(option) : computeTradePrices(detailed);
      setModalMarket({
        title: option ? `${option.name} - ${detailed.title}` : detailed.title,
        image: resolveImageSrc(detailed.image),
        prices
      });
      open(nextSide, "buy");
    },
    [open]
  );

  const handleTitleDoubleClick = useCallback((href: string) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    if (typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }, []);

  useEffect(() => {
    if (sharedContext) return;
    if (segments.length === 0) return;
    setLocalActiveId((current) => {
      if (segments.some((segment) => segment.id === current)) return current;
      return segments[0].id;
    });
  }, [segments, sharedContext]);

  const activeSegment = useMemo(
    () => segments.find((segment) => segment.id === activeId) ?? segments[0],
    [segments, activeId]
  );

  const activeMarkets = activeSegment?.markets ?? [];
  const trimmedSearch = searchQuery.trim();
  const searchTokens = useMemo(
    () => {
      if (trimmedSearch.length === 0) return [];
      const normalized = normalizeSearchText(trimmedSearch);
      return normalized.split(/\s+/).filter(Boolean);
    },
    [trimmedSearch]
  );
  const filteredMarkets = useMemo(
    () => {
      if (searchTokens.length === 0) return [];
      return markets.filter((market) => marketMatchesSearchTokens(market, searchTokens));
    },
    [markets, searchTokens]
  );
  const isSearching = searchTokens.length > 0;
  const visibleMarkets = isSearching ? filteredMarkets : activeMarkets;
  const displayQuery = trimmedSearch;

  if (!activeSegment) return null;

  const shouldRenderHeader = variant === "full" || variant === "header";
  const shouldRenderContent = variant === "full" || variant === "content";
  const isHeaderOnly = shouldRenderHeader && !shouldRenderContent;
  const sectionClassName = isHeaderOnly ? `${styles.hero} ${styles.heroHeaderOnly}` : styles.hero;

  return (
    <section className={sectionClassName} aria-labelledby="markets-hero-heading">
      {shouldRenderHeader && (
        <div className={styles.headerGroup} data-testid="hero-header-group">
          <div className={styles.topRow} data-testid="hero-header-top-row">
            <div className={styles.brand}>{brand}</div>
            <div className={styles.actions}>{actions}</div>
          </div>
          <div className={styles.heroNavGroup} data-testid="hero-nav-group">
            <div className={styles.heroNav} role="tablist" aria-label="Segmentos de mercados destacados">
              {segments.map((segment) => {
                const tabId = `hero-tab-${segment.id}`;
                const panelId = `hero-panel-${segment.id}`;
                const isActive = activeSegment.id === segment.id;
                return (
                  <button
                    key={segment.id}
                    id={tabId}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={panelId}
                    className={isActive ? `${styles.heroTab} ${styles.heroTabActive}` : styles.heroTab}
                    onClick={() => {
                      setActiveId(segment.id);
                      if (pathname !== "/") {
                        router.push(`/?segment=${segment.id}`);
                      }
                    }}
                  >
                    {segment.label}
                  </button>
                );
              })}
            </div>
            {showDivider && <div className={styles.heroDivider} aria-hidden="true" data-testid="hero-divider" />}
          </div>
        </div>
      )}
      {shouldRenderContent && (
        <div className={styles.heroContent} data-testid="hero-content">
          <div className={styles.heroSearchBarRow}>
            <SearchBar
              placeholder="Buscar mercados..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setSearchQuery("");
                  event.currentTarget.blur();
                }
              }}
            />
          </div>
          {isSearching && (
            <div className={styles.heroSearchMeta} data-testid="hero-search-meta">
              <span>
                {filteredMarkets.length > 0
                  ? `${filteredMarkets.length === 1 ? "1 resultado" : `${filteredMarkets.length} resultados`} para "${displayQuery}"`
                  : `Sin resultados para "${displayQuery}"`}
              </span>
              <button
                type="button"
                className={styles.heroSearchClear}
                onClick={() => setSearchQuery("")}
              >
                Limpiar
              </button>
            </div>
          )}

          {visibleMarkets.length > 0 ? (
            <div className={styles.heroPreview}>
              {visibleMarkets.map((market) => {
                const probability = getLatestProbability(market);
                const probabilityLabel = probability !== null ? formatProbability(probability) : undefined;
                const volumeLabel = formatVolume(market);
                const imageSrc = resolveImageSrc(market.image);
                const marketHref = `/markets/${market.slug}`;
                const isMultiOption = isMultiOptionMarket(market);
                const topOptions = isMultiOption ? getTopMarketOptions(market, 2) : [];

                return (
                  <article key={market.slug} className={styles.previewCard} data-testid="hero-preview-card">
                    <div className={styles.previewHeader}>
                      <div className={styles.previewIdentity}>
                        <img
                          src={imageSrc}
                          alt=""
                          role="presentation"
                          className={styles.previewMedia}
                          onError={(event) => {
                            if (event.currentTarget.src.endsWith("/markets/placeholder.svg")) return;
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = "/markets/placeholder.svg";
                          }}
                        />
                        <div className={styles.previewBody}>
                          <h3>
                            <a
                              href={marketHref}
                              onClick={(event) => {
                                event.preventDefault();
                                handleTitleClick(marketHref);
                              }}
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                handleTitleDoubleClick(marketHref);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  router.push(marketHref);
                                }
                              }}
                            >
                              {market.title}
                            </a>
                          </h3>
                        </div>
                      </div>
                      {probabilityLabel && <div className={styles.previewOdds}>{probabilityLabel}</div>}
                    </div>

                    <div className={styles.previewFooter}>
                      {isMultiOption ? (
                        <div className={styles.previewOptionList} data-testid="hero-preview-option-list">
                          {topOptions.map((option) => (
                            <div
                              key={`${market.slug}-${option.name}`}
                              className={styles.previewOptionRow}
                              data-testid="hero-preview-option-row"
                            >
                              <span
                                className={styles.previewOptionName}
                                title={option.name}
                                data-hero-option-name
                              >
                                {option.name}
                              </span>
                              <span
                                className={styles.previewOptionProbability}
                                data-hero-option-probability
                              >
                                {formatOptionProbability(option.probability)}
                              </span>
                              <button
                                type="button"
                                className={`${styles.previewOptionButton} ${styles.previewOptionButtonYes}`}
                                data-hero-option-trade="yes"
                                data-yes-mint={option.yesMint}
                                onClick={() => handleTradeClick(market, "yes", option)}
                                aria-label={`Comprar Sí en ${option.name}`}
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                className={`${styles.previewOptionButton} ${styles.previewOptionButtonNo}`}
                                data-hero-option-trade="no"
                                data-no-mint={option.noMint}
                                onClick={() => handleTradeClick(market, "no", option)}
                                aria-label={`Comprar No en ${option.name}`}
                              >
                                No
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.previewActions} data-testid="hero-preview-actions">
                          <button
                            type="button"
                            className={`${styles.previewButton} ${styles.previewButtonYes}`}
                            data-hero-trade="yes"
                            onClick={() => handleTradeClick(market, "yes")}
                            aria-label={`Comprar Sí en ${market.title}`}
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            className={`${styles.previewButton} ${styles.previewButtonNo}`}
                            data-hero-trade="no"
                            onClick={() => handleTradeClick(market, "no")}
                            aria-label={`Comprar No en ${market.title}`}
                          >
                            No
                          </button>
                        </div>
                      )}
                      <span className={styles.previewVolume}>{volumeLabel}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            isSearching ? (
              <div className={styles.heroEmpty} data-testid="hero-search-empty">
                No encontramos mercados que coincidan con "{displayQuery}". Intenta con otro término o revisa los segmentos destacados.
              </div>
            ) : (
              <div className={styles.heroEmpty}>No hay mercados disponibles en esta categoría todavía.</div>
            )
          )}
        </div>
      )}
      {modalMarket && (
        <TradeModal
          isOpen={isOpen}
          side={side}
          intent={intent}
          onClose={handleModalClose}
          onSelectIntent={setIntent}
          onSelectSide={setSide}
          marketTitle={modalMarket.title}
          marketImage={modalMarket.image}
          prices={modalMarket.prices}
        />
      )}
    </section>
  );
}

type PriceInfo = {
  label: string;
  value: number | null;
};

function getLatestProbability(market: UiMarket): number | null {
  const history = Array.isArray(market.history) ? market.history : [];
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  return typeof last.yes === "number" ? last.yes : null;
}

function formatProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function formatVolume(market: UiMarket): string {
  const history: HistoryPoint[] = Array.isArray(market.history) ? market.history : [];
  const base = market.minBaseQty ?? 0;
  const inferred = history.reduce((sum, point) => sum + (point.yes + point.no) * 100, 0);
  const estimate = Math.max(inferred, base * 25, 500);
  return `${currencyFormatter.format(Math.round(estimate))} Vol.`;
}

function resolveImageSrc(source?: string): string {
  if (typeof source !== "string") return "/markets/placeholder.svg";
  const trimmed = source.trim();
  if (trimmed.length === 0) return "/markets/placeholder.svg";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("public/")) return `/${trimmed.slice("public/".length)}`;
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

function computeTradePrices(market: UiMarket): { yes: PriceInfo; no: PriceInfo } {
  const history = Array.isArray(market.history) ? market.history : [];
  const latest = history.length > 0 ? history[history.length - 1] : undefined;
  const yesValue = typeof latest?.yes === "number" ? latest.yes : null;
  const noValue =
    typeof latest?.no === "number"
      ? latest.no
      : typeof yesValue === "number"
        ? 1 - yesValue
        : null;

  return {
    yes: { label: formatPrice(yesValue), value: yesValue },
    no: { label: formatPrice(noValue), value: noValue }
  };
}

function formatPrice(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  const normalized = Math.max(0, Math.min(1, value));
  return `$${normalized.toFixed(2)}`;
}

function computeOptionTradePrices(option: UiMarketOption): { yes: PriceInfo; no: PriceInfo } {
  const yesValue = clampProbability(option.probability);
  const noValue = typeof yesValue === "number" ? clampProbability(1 - yesValue) : null;
  return {
    yes: { label: formatPrice(yesValue), value: yesValue },
    no: { label: formatPrice(noValue), value: noValue }
  };
}

function formatOptionProbability(value: number | null | undefined): string {
  const normalized = clampProbability(value);
  if (typeof normalized !== "number") {
    return "—";
  }
  return formatProbability(normalized);
}

function marketMatchesSearchTokens(market: UiMarket, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const parts: string[] = [
    market.title,
    market.summary ?? "",
    market.slug.replace(/[-_]/g, " ")
  ];
  if (Array.isArray(market.options)) {
    for (const option of market.options) {
      if (option && typeof option.name === "string") {
        parts.push(option.name);
      }
    }
  }
  const haystack = normalizeSearchText(parts.join(" "));
  return tokens.every((token) => haystack.includes(token));
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
