"use client";

import { useState } from "react";
import type { Connection } from "@solana/web3.js";

type Props = {
  connection: Connection;
  programIdStr: string;
};

/**  create-market form with client-side validation. */
export default function CreateMarketForm({ connection, programIdStr }: Props) {
  const [baseMint, setBaseMint] = useState("");
  const [quoteMint, setQuoteMint] = useState("");
  const [tickSize, setTickSize] = useState("");
  const [minBaseQty, setMinBaseQty] = useState("");
  const [feesBps, setFeesBps] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);

    if (!isValidPubkey(baseMint) || !isValidPubkey(quoteMint)) {
      setError("Invalid mint address format");
      return;
    }
    const tick = parsePositiveInt(tickSize);
    const minQty = parsePositiveInt(minBaseQty);
    const fees = parsePositiveInt(feesBps);
    if (tick === null || minQty === null || fees === null || fees > 1000) {
      setError("Invalid numeric values");
      return;
    }

    console.log("Ready to create market", {
      programIdStr,
      endpoint: (connection as any)?._rpcEndpoint,
      baseMint,
      quoteMint,
      tick,
      minQty,
      fees,
    });
    setOk(true);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Program: {programIdStr}</div>

      <label>
        Base mint
        <input
          required
          value={baseMint}
          onChange={(e) => setBaseMint(e.target.value)}
          inputMode="text"
          pattern="[1-9A-HJ-NP-Za-km-z]{32,44}"
          minLength={32}
          maxLength={44}
        />
      </label>

      <label>
        Quote mint
        <input
          required
          value={quoteMint}
          onChange={(e) => setQuoteMint(e.target.value)}
          inputMode="text"
          pattern="[1-9A-HJ-NP-Za-km-z]{32,44}"
          minLength={32}
          maxLength={44}
        />
      </label>

      <label>
        Tick size
        <input
          required
          value={tickSize}
          onChange={(e) => setTickSize(e.target.value)}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
        />
      </label>

      <label>
        Min base qty
        <input
          required
          value={minBaseQty}
          onChange={(e) => setMinBaseQty(e.target.value)}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
        />
      </label>

      <label>
        Fees (bps)
        <input
          required
          value={feesBps}
          onChange={(e) => setFeesBps(e.target.value)}
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          step={1}
        />
      </label>

      <button type="submit">Create market</button>

      {error && <div style={{ color: "var(--color-danger)", fontSize: 12 }}>{error}</div>}
      {ok && <div style={{ color: "var(--color-success)", fontSize: 12 }}>Validated. Wire to SDK next.</div>}
    </form>
  );
}

/** Base58-like pubkey format check with length bounds. */
function isValidPubkey(v: string): boolean {
  if (!v) return false;
  const re = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return re.test(v) && v.length >= 32 && v.length <= 44;
}

/** Parses a positive integer or returns null. */
function parsePositiveInt(v: string): number | null {
  if (!v) return null; 
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n % 1 !== 0) return null;
  if (n <= 0) return null;
  return n;
}
