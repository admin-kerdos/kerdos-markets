"use client";

import { useTradeModal } from "@/hooks/useTradeModal";

import styles from "./page.module.css";
import TradeModal from "./TradeModal.client";

type PricePreview = {
  label: string;
  value: number | null;
};

type MarketActionButtonsProps = {
  marketTitle: string;
  marketImage: string;
  prices: {
    yes: PricePreview;
    no: PricePreview;
  };
};

export default function MarketActionButtons({ marketTitle, marketImage, prices }: MarketActionButtonsProps) {
  const { isOpen, side, intent, open, close, setIntent, setSide } = useTradeModal();

  return (
    <>
      <section className={styles.actionButtons} data-market-action-buttons>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.actionButtonYes}`}
          onClick={() => open("yes", "buy")}
          data-market-action="yes"
        >
          <span className={styles.actionLabel} data-testid="market-action-label-yes">
            Sí
          </span>
          <span className={styles.actionPrice} data-testid="market-action-price-yes">
            {prices.yes.label}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.actionButtonNo}`}
          onClick={() => open("no", "buy")}
          data-market-action="no"
        >
          <span className={styles.actionLabel} data-testid="market-action-label-no">
            No
          </span>
          <span className={styles.actionPrice} data-testid="market-action-price-no">
            {prices.no.label}
          </span>
        </button>
      </section>
      <TradeModal
        isOpen={isOpen}
        side={side}
        intent={intent}
        onClose={close}
        onSelectIntent={setIntent}
        onSelectSide={setSide}
        marketTitle={marketTitle}
        marketImage={marketImage}
        prices={prices}
      />
    </>
  );
}
