import pkg from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  ConfirmOptions,
} from "@solana/web3.js";

const anchor = pkg as typeof import("@coral-xyz/anchor");
export default anchor;
export const { AnchorProvider, workspace, BN } = anchor;
export const SYS_PROG = SystemProgram.programId;

export function envNum(name: string, def: number) {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export async function airdropSOL(provider: import("@coral-xyz/anchor").AnchorProvider, lamports: number) {
  const sig = await provider.connection.requestAirdrop(provider.wallet.publicKey, lamports);
  const latest = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction(
    { signature: sig, ...latest },
    "confirmed" as ConfirmOptions["commitment"]
  );
}

export function randomMints() {
  return { baseMint: Keypair.generate().publicKey, quoteMint: Keypair.generate().publicKey };
}

export function derivePDAs(programId: PublicKey, baseMint: PublicKey, quoteMint: PublicKey) {
  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_market"), baseMint.toBuffer(), quoteMint.toBuffer()],
    programId
  );
  const [bids] = PublicKey.findProgramAddressSync([Buffer.from("kerdos_bids"), market.toBuffer()], programId);
  const [asks] = PublicKey.findProgramAddressSync([Buffer.from("kerdos_asks"), market.toBuffer()], programId);
  const [eventQueue] = PublicKey.findProgramAddressSync([Buffer.from("kerdos_eventq"), market.toBuffer()], programId);
  return { market, bids, asks, eventQueue };
}

export async function lamportsOf(provider: import("@coral-xyz/anchor").AnchorProvider, key: PublicKey) {
  return provider.connection.getBalance(key, "confirmed");
}

export async function confirmAndGetLogs(provider: import("@coral-xyz/anchor").AnchorProvider, sig: string) {
  const latest = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  const tx = await provider.connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  return tx?.meta?.logMessages ?? [];
}

export function parseConsumedCU(logs: string[]) {
  for (const l of logs) {
    const m = l.match(/consumed\s+(\d+)\s+of\s+(\d+)\s+compute units/i);
    if (m) return Number(m[1]);
  }
  return null;
}

export const LITE_PROFILE = {
  bids_capacity: 1024,
  asks_capacity: 1024,
  event_queue_capacity: 512,
  tick_size: new BN(10_000),
  min_base_qty: new BN(100),
  fees_bps: 10,
};

export const ComputeLimitIx = (units: number) => ComputeBudgetProgram.setComputeUnitLimit({ units });

export const Sizing = {
  MARKET_DISCRIMINATOR: 8,
  MARKET_HEADER:
    32 + 32 + 32 + 32 + 32 + 32 +
    8 + 8 + 2 + 1 +
    1 + 1 + 1 + 1 +
    4 + 4 + 4 +
    1,
  BLOB_HEADER: 4 + 1 + 4 + 4,
  BLOB_ANCHOR_PAD: 8,
  SLAB_NODE_EST: 64,
  EVENT_EST: 48,
  marketSpace(): number {
    return this.MARKET_DISCRIMINATOR + this.MARKET_HEADER;
  },
  bidsSpace(cap: number): number {
    return this.BLOB_ANCHOR_PAD + this.BLOB_HEADER + cap * this.SLAB_NODE_EST;
  },
  asksSpace(cap: number): number {
    return this.BLOB_ANCHOR_PAD + this.BLOB_HEADER + cap * this.SLAB_NODE_EST;
  },
  eventqSpace(cap: number): number {
    return this.BLOB_ANCHOR_PAD + this.BLOB_HEADER + cap * this.EVENT_EST;
  },
  total(b: number, a: number, e: number): number {
    return this.marketSpace() + this.bidsSpace(b) + this.asksSpace(a) + this.eventqSpace(e);
  },
};

export const LAMPORTS_PER_SOL_CONST = LAMPORTS_PER_SOL;
