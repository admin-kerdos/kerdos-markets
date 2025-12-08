"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTradeModal, type TradeSide } from "@/hooks/useTradeModal";
import type { UiMarketOption } from "@/lib/markets";
import { clampProbability, sortMarketOptions } from "@/lib/markets";

import styles from "./page.module.css";
import TradeModal from "./TradeModal.client";

type PricePreview = {
  label: string;
  value: number | null;
};

type PricePair = {
  yes: PricePreview;
  no: PricePreview;
};

type MarketActionButtonsProps = {
  marketTitle: string;
  marketImage: string;
  prices?: PricePair;
  multiOption?: boolean;
  options?: UiMarketOption[];
};

type ModalMarketState = {
  title: string;
  prices: PricePair;
};

const EMPTY_PRICE_PAIR: PricePair = {
  yes: { label: "—", value: null },
  no: { label: "—", value: null }
};

export default function MarketActionButtons({
  marketTitle,
  marketImage,
  prices,
  multiOption = false,
  options
}: MarketActionButtonsProps) {
  const { isOpen, side, intent, open, close, setIntent, setSide } = useTradeModal();

  const displayPrices = useMemo<PricePair>(() => prices ?? EMPTY_PRICE_PAIR, [prices]);
  const [modalMarket, setModalMarket] = useState<ModalMarketState>({
    title: marketTitle,
    prices: displayPrices
  });

  useEffect(() => {
    setModalMarket({
      title: marketTitle,
      prices: displayPrices
    });
  }, [marketTitle, displayPrices]);

  const hasOptions = Boolean(multiOption) && Array.isArray(options) && options.length > 0;
  const sortedOptions = useMemo(
    () => (hasOptions ? sortMarketOptions(options) : []),
    [hasOptions, options]
  );

  const handleSingleTrade = useCallback(
    (nextSide: TradeSide) => {
      setModalMarket({
        title: marketTitle,
        prices: displayPrices
      });
      open(nextSide, "buy");
    },
    [displayPrices, marketTitle, open]
  );

  const handleOptionTrade = useCallback(
    (option: UiMarketOption, nextSide: TradeSide) => {
      const optionPrices = computeOptionPricePair(option);
      setModalMarket({
        title: `${option.name} - ${marketTitle}`,
        prices: optionPrices
      });
      open(nextSide, "buy");
    },
    [marketTitle, open]
  );

  return (
    <>
      <section
        className={hasOptions ? styles.multiOptionList : styles.actionButtons}
        data-market-action-buttons
      >
        {hasOptions ? (
          sortedOptions.map((option) => (
            <div
              key={`${option.name}-${option.yesMint}`}
              className={styles.multiOptionRow}
              data-market-option-row
            >
              <span className={styles.multiOptionName} title={option.name} data-market-option-name>
                {option.name}
              </span>
              <span className={styles.multiOptionProbability} data-market-option-probability>
                {formatOptionProbability(option.probability)}
              </span>
              <button
                type="button"
                className={`${styles.multiOptionButton} ${styles.multiOptionButtonYes}`}
                onClick={() => handleOptionTrade(option, "yes")}
                data-market-option-action="yes"
                data-yes-mint={option.yesMint}
                aria-label={`Comprar Sí en ${option.name}`}
              >
                Sí
              </button>
              <button
                type="button"
                className={`${styles.multiOptionButton} ${styles.multiOptionButtonNo}`}
                onClick={() => handleOptionTrade(option, "no")}
                data-market-option-action="no"
                data-no-mint={option.noMint}
                aria-label={`Comprar No en ${option.name}`}
              >
                No
              </button>
            </div>
          ))
        ) : (
          <>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionButtonYes}`}
              onClick={() => handleSingleTrade("yes")}
              data-market-action="yes"
            >
              <span className={styles.actionLabel} data-testid="market-action-label-yes">
                Sí
              </span>
              <span className={styles.actionPrice} data-testid="market-action-price-yes">
                {displayPrices.yes.label}
              </span>
            </button>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionButtonNo}`}
              onClick={() => handleSingleTrade("no")}
              data-market-action="no"
            >
              <span className={styles.actionLabel} data-testid="market-action-label-no">
                No
              </span>
              <span className={styles.actionPrice} data-testid="market-action-price-no">
                {displayPrices.no.label}
              </span>
            </button>
          </>
        )}
      </section>
      <TradeModal
        isOpen={isOpen}
        side={side}
        intent={intent}
        onClose={close}
        onSelectIntent={setIntent}
        onSelectSide={setSide}
        marketTitle={modalMarket.title}
        marketImage={marketImage}
        prices={modalMarket.prices}
      />
    </>
  );
}

function computeOptionPricePair(option: UiMarketOption): PricePair {
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
  return `${Math.round(normalized * 100)}%`;
}

function formatPrice(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  const normalized = Math.max(0, Math.min(1, value));
  return `$${normalized.toFixed(2)}`;
}
