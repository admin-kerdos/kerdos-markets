"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { TradeIntent, TradeSide } from "@/hooks/useTradeModal";

import styles from "./page.module.css";

type PriceInfo = {
  label: string;
  value: number | null;
};

type TradeModalProps = {
  isOpen: boolean;
  side: TradeSide;
  intent: TradeIntent;
  onClose: () => void;
  onSelectIntent: (intent: TradeIntent) => void;
  onSelectSide: (side: TradeSide) => void;
  marketTitle: string;
  marketImage: string;
  prices: {
    yes: PriceInfo;
    no: PriceInfo;
  };
};

export default function TradeModal({
  isOpen,
  side,
  intent,
  onClose,
  onSelectIntent,
  onSelectSide,
  marketTitle,
  marketImage,
  prices
}: TradeModalProps) {
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setAmount("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const node = amountInputRef.current;
    if (node) {
      node.focus({ preventScroll: true });
      node.select();
    }
  }, [isOpen, side, intent]);

  const priceValue = useMemo<number>(() => {
    const raw = side === "yes" ? prices.yes.value : prices.no.value;
    if (typeof raw !== "number" || Number.isNaN(raw)) {
      return 0;
    }
    return raw;
  }, [prices.no.value, prices.yes.value, side]);

  const amountValue = useMemo<number>(() => {
    const parsed = Number.parseFloat(amount.replace(",", "."));
    if (Number.isNaN(parsed) || parsed <= 0) {
      return 0;
    }
    return parsed;
  }, [amount]);

  const pricePerContract = useMemo<number>(() => {
    if (intent === "buy") {
      return priceValue;
    }
    return 1 - priceValue;
  }, [intent, priceValue]);

  const contracts = useMemo<number>(() => {
    if (pricePerContract <= 0) return 0;
    return amountValue / pricePerContract;
  }, [amountValue, pricePerContract]);

  const potentialPayout = contracts;
  const hasAmount = amountValue > 0;

  const actionTitle = intent === "buy" ? "Comprar" : "Vender";
  const confirmLabel = intent === "buy" ? "Confirmar compra" : "Confirmar venta";
  const sideLabel = side === "yes" ? "Sí" : "No";
  const dialogTitle = `${actionTitle} ${sideLabel}`;

  const renderPriceLabel = (targetSide: TradeSide) => {
    const info = targetSide === "yes" ? prices.yes : prices.no;
    const prefix = targetSide === "yes" ? "Sí" : "No";
    if (!info || !info.label || info.label === "—") {
      return `${prefix} —`;
    }
    return `${prefix} ${info.label}`;
  };

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className={styles.tradeModalOverlay}
      role="presentation"
      onClick={onClose}
      data-trade-modal-overlay
    >
      <div
        className={styles.tradeModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-modal-title"
        onClick={(event) => event.stopPropagation()}
        data-trade-modal
      >
        <header className={styles.tradeModalHeader}>
          <div className={styles.tradeModalHeading}>
            <div className={styles.tradeModalMarketIdentity}>
              <div className={styles.tradeModalImageWrapper}>
                <Image
                  src={marketImage}
                  alt=""
                  width={48}
                  height={48}
                  className={styles.tradeModalImage}
                />
              </div>
              <div className={styles.tradeModalMarketBody}>
                <p className={styles.tradeModalMarketLabel}>Mercado</p>
                <h2 id="trade-modal-title">{marketTitle}</h2>
              </div>
            </div>
            <p className={styles.tradeModalActionLabel} data-trade-modal-selected-action>
              {dialogTitle}
            </p>
          </div>
        </header>

        <div className={styles.tradeModalBody}>
          <div className={styles.tradeModalIntentToggle} role="group" aria-label="Tipo de orden">
            <button
              type="button"
              className={`${styles.tradeModalIntentButton} ${
                intent === "buy" ? styles.tradeModalIntentActive : ""
              }`}
              onClick={() => onSelectIntent("buy")}
              aria-pressed={intent === "buy"}
              data-trade-modal-buy
            >
              Comprar
            </button>
            <button
              type="button"
              className={`${styles.tradeModalIntentButton} ${
                intent === "sell" ? styles.tradeModalIntentActive : ""
              }`}
              onClick={() => onSelectIntent("sell")}
              aria-pressed={intent === "sell"}
              data-trade-modal-sell
            >
              Vender
            </button>
          </div>

          <div className={styles.tradeModalSideSelector}>
            <button
              type="button"
              className={`${styles.tradeModalSideButton} ${
                side === "yes" ? styles.tradeModalSideActiveYes : ""
              }`}
              onClick={() => onSelectSide("yes")}
              aria-pressed={side === "yes"}
              data-trade-modal-side="yes"
            >
              {renderPriceLabel("yes")}
            </button>
            <button
              type="button"
              className={`${styles.tradeModalSideButton} ${
                side === "no" ? styles.tradeModalSideActiveNo : ""
              }`}
              onClick={() => onSelectSide("no")}
              aria-pressed={side === "no"}
              data-trade-modal-side="no"
            >
              {renderPriceLabel("no")}
            </button>
          </div>

          <label className={styles.tradeModalFieldLabel} htmlFor="trade-modal-amount">
            Inversión
          </label>
          <input
            id="trade-modal-amount"
            ref={amountInputRef}
            type="number"
            min="0"
            step="0.1"
            className={styles.tradeModalInput}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            data-trade-modal-amount
          />

          {hasAmount && (
            <div className={styles.tradeModalMetrics} data-trade-modal-estimate>
              <p className={styles.tradeModalMetricLabel}>Ganancia estimada</p>
              <p className={styles.tradeModalMetricValue} data-trade-modal-estimated>
                ${potentialPayout.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        <footer className={styles.tradeModalFooter}>
          <button
            type="button"
            className={styles.tradeModalConfirm}
            onClick={onClose}
            data-trade-modal-confirm
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className={styles.tradeModalSecondary}
            onClick={onClose}
            data-trade-modal-close
          >
            Cancelar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
