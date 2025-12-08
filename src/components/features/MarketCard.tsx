"use client";

import Link from "next/link";
import { isMultiOptionMarket, seeded, type UiMarket } from "@/lib/markets";
import styles from "@/styles/components/MarketCard.module.css";

type Props = {
  market: UiMarket;
};

const resolutionFormatter = new Intl.DateTimeFormat("es-CR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

const numberFormatter = new Intl.NumberFormat("es-CR", {
  maximumFractionDigits: 2
});

export default function MarketCard({ market }: Props) {
  const image = market.image ?? "/markets/placeholder.svg";
  const summary =
    market.summary && market.summary.trim().length > 0
      ? market.summary
      : market.rules[0] && market.rules[0].trim().length > 0
        ? market.rules[0]
        : "Negocia la probabilidad de este evento con liquidez programable.";
  const resolvesAt = market.resolvesAt ? new Date(market.resolvesAt) : undefined;
  const resolutionLabel =
    resolvesAt && !Number.isNaN(resolvesAt.getTime())
      ? resolutionFormatter.format(resolvesAt)
      : undefined;
  const live = seeded(market);
  const firstOption = isMultiOptionMarket(market) ? market.options[0] : undefined;
  const yesMint = market.yesMint ?? firstOption?.yesMint;
  const noMint = market.noMint ?? firstOption?.noMint;
  const statusLabel = live ? "Trading live" : "Opening soon";
  const feeValue = (market.feesBps ?? 0) / 100;
  const feeLabel = `${feeValue % 1 === 0 ? feeValue.toFixed(0) : feeValue.toFixed(2)}%`;
  const metrics = [
    { label: "Min order", value: numberFormatter.format(market.minBaseQty) },
    { label: "Fee", value: feeLabel },
    { label: "Sí mint", value: abbreviate(yesMint) },
    { label: "No mint", value: abbreviate(noMint) }
  ];

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <img src={image} alt={market.title} loading="lazy" />
      </div>
      <div className={styles.body}>
        <div className={styles.topline}>
          <span className={`${styles.status} ${live ? styles.statusLive : styles.statusPending}`}>{statusLabel}</span>
          {resolutionLabel && <span className={styles.timestamp}>{resolutionLabel}</span>}
        </div>
        <h2 className={styles.title}>{market.title}</h2>
        {summary && <p className={styles.summary}>{summary}</p>}
        <dl className={styles.metrics}>
          {metrics.map((metric) => (
            <div key={`${market.slug}-${metric.label}`} className={styles.metricItem}>
              <dt className={styles.metricLabel}>{metric.label}</dt>
              <dd className={styles.metricValue}>{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={styles.footer}>
        <Link href="#" className={`${styles.action} ${styles.actionYes}`}>
          Sí
        </Link>
        <Link href="#" className={`${styles.action} ${styles.actionNo}`}>
          No
        </Link>
      </div>
    </article>
  );
}

function abbreviate(value?: string) {
  if (!value || value.length === 0) return "—";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
