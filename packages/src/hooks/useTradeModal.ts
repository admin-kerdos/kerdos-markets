"use client";

import { useCallback, useState } from "react";

export type TradeIntent = "buy" | "sell";
export type TradeSide = "yes" | "no";

type ModalState = {
  isOpen: boolean;
  side: TradeSide;
  intent: TradeIntent;
};

export function useTradeModal(initialIntent: TradeIntent = "buy") {
  const [{ isOpen, side, intent }, setState] = useState<ModalState>({
    isOpen: false,
    side: "yes",
    intent: initialIntent
  });

  const open = useCallback((nextSide: TradeSide, nextIntent: TradeIntent = "buy") => {
    setState({
      isOpen: true,
      side: nextSide,
      intent: nextIntent
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false
    }));
  }, []);

  const setIntent = useCallback((nextIntent: TradeIntent) => {
    setState((prev) => ({
      ...prev,
      intent: nextIntent
    }));
  }, []);

  const setSide = useCallback((nextSide: TradeSide) => {
    setState((prev) => ({
      ...prev,
      side: nextSide
    }));
  }, []);

  return {
    isOpen,
    side,
    intent,
    open,
    close,
    setIntent,
    setSide
  };
}
