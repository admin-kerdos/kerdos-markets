import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import type { HistoryPoint, UiMarket } from "@/lib/markets";
import { ensureHistory, getMarketBySlug, isMultiOptionMarket, sortMarketOptions } from "@/lib/markets";
import MarketCoverImage from "@/components/market/MarketCoverImage";
import MarketHeroIdentity from "@/components/market/MarketHeroIdentity";

import MarketActionButtons from "./MarketActionButtons.client";

import styles from "./page.module.css";

const ProbabilityChart = dynamic(() => import("@/components/ProbabilityChart"), {
  ssr: false,
  loading: () => <div className={styles.chartFallback}>Preparando gráfico…</div>
});

type PageProps = {
  params: {
    slug: string;
  };
};

export default function MarketDetailPage({ params }: PageProps) {
  const market = getMarketBySlug(params.slug);
  if (!market) {
    notFound();
  }

  const detailed = ensureHistory(market);
  const probability = getLatestProbability(detailed);
  const probabilityLabel = typeof probability === "number" ? `${Math.round(probability * 100)}%` : "–";
  const coverSrc = resolveImageSrc(detailed.image);
  const latestPoint = getLatestHistoryPoint(detailed);
  const yesPriceValue = typeof latestPoint?.yes === "number" ? latestPoint.yes : null;
  const noPriceValue =
    typeof latestPoint?.no === "number"
      ? latestPoint.no
      : typeof yesPriceValue === "number"
        ? 1 - yesPriceValue
        : null;
  const yesPriceLabel = formatPrice(yesPriceValue);
  const noPriceLabel = formatPrice(noPriceValue);
  const multiOption = isMultiOptionMarket(detailed);
  const marketOptions = multiOption ? sortMarketOptions(detailed.options) : [];

  const resolvesAtLabel = detailed.resolvesAt
    ? formatDateLabel(detailed.resolvesAt)
    : "Fecha por confirmar";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.layout}>
          <div className={styles.detailContent}>
            <article className={styles.heroCard} data-testid="market-hero-card">
              <MarketHeroIdentity className={styles.heroIdentity} distance={140} data-testid="market-hero">
                <MarketCoverImage
                  src={coverSrc}
                  alt=""
                  role="presentation"
                  className={styles.cover}
                  loading="lazy"
                  data-testid="market-hero-image"
                />
                <div className={styles.identityBody}>
                  <h1 data-testid="market-hero-title">{detailed.title}</h1>
                  {detailed.summary && <p className={styles.summary}>{detailed.summary}</p>}
                </div>
              </MarketHeroIdentity>

              <div className={styles.metrics}>
                <div>
                  <p className={styles.metaLabel}>Probabilidad Sí</p>
                  <p className={styles.metricValue}>{probabilityLabel}</p>
                </div>
                <div>
                  <p className={styles.metaLabel}>Resuelve</p>
                  <p className={styles.metricValue} style={{ fontSize: "clamp(18px, 2vw, 28px)" }}>
                    {resolvesAtLabel}
                  </p>
                </div>
              </div>
            </article>

            <section className={styles.chartSection}>
              <div className={styles.chartCard} data-testid="market-chart-card">
                <h2>Historial de probabilidades</h2>
                {detailed.history && detailed.history.length > 0 ? (
                  <ProbabilityChart history={detailed.history} />
                ) : (
                  <div className={styles.chartFallback}>Sin datos suficientes</div>
                )}
              </div>
            </section>

            <MarketActionButtons
              marketTitle={detailed.title}
              marketImage={coverSrc}
              multiOption={multiOption}
              options={marketOptions}
              prices={
                multiOption
                  ? undefined
                  : {
                      yes: { label: yesPriceLabel, value: yesPriceValue },
                      no: { label: noPriceLabel, value: noPriceValue }
                    }
              }
            />

            <section className={styles.rulesPanel} data-testid="market-rules-panel">
              <h2>Reglas</h2>
              <ul className={styles.rulesList}>
                {detailed.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function getLatestHistoryPoint(market: UiMarket): HistoryPoint | null {
  const history = Array.isArray(market.history) ? market.history : [];
  if (history.length === 0) return null;
  return history[history.length - 1] ?? null;
}

function formatPrice(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  const normalized = Math.max(0, Math.min(1, value));
  return `$${normalized.toFixed(2)}`;
}

function getLatestProbability(market: UiMarket): number | null {
  const history = Array.isArray(market.history) ? market.history : [];
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  return typeof last.yes === "number" ? last.yes : null;
}

function formatDateLabel(dateString: string): string {
  try {
    return new Intl.DateTimeFormat("es-CR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(dateString));
  } catch (error) {
    return dateString;
  }
}

function resolveImageSrc(src?: string): string {
  if (!src) return "/markets/placeholder.svg";
  if (src.startsWith("http")) return src;
  if (src.startsWith("/")) return src;
  return `/${src.replace(/^public\//, "")}`;
}
