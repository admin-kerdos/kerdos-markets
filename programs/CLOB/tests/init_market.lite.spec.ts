import anchor, {
  AnchorProvider,
  workspace,
  airdropSOL,
  derivePDAs,
  envNum,
  lamportsOf,
  parseConsumedCU,
  confirmAndGetLogs,
  randomMints,
  LITE_PROFILE,
  SYS_PROG,
  ComputeLimitIx,
  Sizing,
} from "./helpers";
import { describe, it, expect } from "vitest";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("kerdos_markets — init_market Lite", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = (workspace as any).kerdos_markets as import("@coral-xyz/anchor").Program;

  it("crea mercado Lite y reporta space/rent/compute", async () => {
    await airdropSOL(provider, 2 * LAMPORTS_PER_SOL);

    const { baseMint, quoteMint } = randomMints();
    const { market, bids, asks, eventQueue } = derivePDAs(program.programId, baseMint, quoteMint);

    const params = {
      baseMint,
      quoteMint,
      bidsCapacity: LITE_PROFILE.bids_capacity,
      asksCapacity: LITE_PROFILE.asks_capacity,
      eventQueueCapacity: LITE_PROFILE.event_queue_capacity,
      tickSize: LITE_PROFILE.tick_size,
      minBaseQty: LITE_PROFILE.min_base_qty,
      feesBps: LITE_PROFILE.fees_bps,
    };

    const cuIx = ComputeLimitIx(envNum("KERDOS_INIT_CU_LIMIT", 1_400_000));

    const sig = await program.methods
      .initMarket(params)
      .preInstructions([cuIx])
      .accounts({
        payer: provider.wallet.publicKey,
        authority: provider.wallet.publicKey,
        baseMint,
        quoteMint,
        market,
        bids,
        asks,
        eventQueue,
        systemProgram: SYS_PROG,
      })
      .rpc();

    const lmMarket = await lamportsOf(provider, market);
    const lmBids = await lamportsOf(provider, bids);
    const lmAsks = await lamportsOf(provider, asks);
    const lmEventQ = await lamportsOf(provider, eventQueue);
    const totalLamports = lmMarket + lmBids + lmAsks + lmEventQ;
    const totalSOL = totalLamports / LAMPORTS_PER_SOL;

    const spaceMarket = Sizing.marketSpace();
    const spaceBids = Sizing.bidsSpace(params.bidsCapacity);
    const spaceAsks = Sizing.asksSpace(params.asksCapacity);
    const spaceEventQ = Sizing.eventqSpace(params.eventQueueCapacity);
    const spaceTotal = spaceMarket + spaceBids + spaceAsks + spaceEventQ;

    console.log("init_market tx:", sig);
    console.log(`space_total_bytes ${spaceTotal}`);
    console.log(`rent_lamports market=${lmMarket} bids=${lmBids} asks=${lmAsks} eventQ=${lmEventQ}`);
    console.log(`rent_total ${totalLamports} (~${totalSOL.toFixed(6)} SOL)`);

    const logs = await confirmAndGetLogs(provider, sig);
    const consumed = parseConsumedCU(logs);
    console.log("compute_consumed", consumed ?? "N/A");

    const maxRentSOL = envNum("KERDOS_LITE_RENT_MAX_SOL", 0.06);
    expect(totalSOL).toBeLessThanOrEqual(maxRentSOL);
  });
});
