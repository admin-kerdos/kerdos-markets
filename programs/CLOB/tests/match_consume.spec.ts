import { describe, it, expect } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, ComputeBudgetProgram, Keypair } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = (anchor.workspace as any).kerdos_markets as anchor.Program;

const SYS_PROG = anchor.web3.SystemProgram.programId;

function computeLimitIx(units: number) {
  return ComputeBudgetProgram.setComputeUnitLimit({ units });
}

function derivePDAs(
  programId: anchor.web3.PublicKey,
  baseMint: anchor.web3.PublicKey,
  quoteMint: anchor.web3.PublicKey
) {
  const [market] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_market"), baseMint.toBuffer(), quoteMint.toBuffer()],
    programId
  );
  const [bids] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_bids"), market.toBuffer()],
    programId
  );
  const [asks] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_asks"), market.toBuffer()],
    programId
  );
  const [eventQueue] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_eventq"), market.toBuffer()],
    programId
  );
  return { market, bids, asks, eventQueue };
}

async function airdropSOL(pubkey: anchor.web3.PublicKey, lamports: number) {
  const sig = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction(sig);
}

describe("match then maker cancel", () => {
  it("crosses best ask with taker bid; taker OO ends inactive", async () => {
    const baseMint = Keypair.generate().publicKey;
    const quoteMint = Keypair.generate().publicKey;

    const { market, bids, asks, eventQueue } = derivePDAs(
      program.programId,
      baseMint,
      quoteMint
    );

    await airdropSOL(provider.wallet.publicKey, 2 * LAMPORTS_PER_SOL);
    const taker = Keypair.generate();
    await airdropSOL(taker.publicKey, 2 * LAMPORTS_PER_SOL);

    const initParams = {
      baseMint,
      quoteMint,
      bidsCapacity: 1024,
      asksCapacity: 1024,
      eventQueueCapacity: 512,
      tickSize: new anchor.BN(10_000),
      minBaseQty: new anchor.BN(100),
      feesBps: 10,
    };

    await program.methods
      .initMarket(initParams)
      .preInstructions([computeLimitIx(1_400_000)])
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

    // Maker ASK (provider)
    const [ooMaker] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("kerdos_oo"), market.toBuffer(), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    const lock = Math.floor(0.05 * LAMPORTS_PER_SOL);

    await program.methods
      .placeOrder({
        priceTicks: new anchor.BN(10_000), // ask 10k
        baseQty: new anchor.BN(100),
        side: 1, // ask
        lockLamports: new anchor.BN(lock),
        maxSlippageTicks: new anchor.BN(0),
      })
      .accounts({
        payer: provider.wallet.publicKey,
        market,
        bids,
        asks,
        eventQueue,
        ooMaker,
        systemProgram: SYS_PROG,
      } as any) 
      .rpc();

    // Taker BID (taker keypair) at 12k, allow slippage
    const [ooTaker] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("kerdos_oo"), market.toBuffer(), taker.publicKey.toBuffer()],
      program.programId
    );
    await program.methods
      .placeOrder({
        priceTicks: new anchor.BN(12_000),
        baseQty: new anchor.BN(100),
        side: 0, // bid
        lockLamports: new anchor.BN(lock),
        maxSlippageTicks: new anchor.BN(10_000),
      })
      .accounts({
        payer: taker.publicKey,
        market,
        bids,
        asks,
        eventQueue,
        oo: ooTaker,
        systemProgram: SYS_PROG,
      })
      .signers([taker])
      .rpc();

    const takerOo = await (program.account as any).openOrdersLite.fetch(ooTaker);
    expect(takerOo.active).toBe(false);

   
    const makerOo = await (program.account as any).openOrdersLite.fetch(ooMaker);
    if (makerOo.active) {
      await program.methods
        .cancelOrder()
        .accounts({
          payer: provider.wallet.publicKey,
          market,
          oo: ooMaker,
        })
        .rpc();
      const makerOoAfter = await (program.account as any).openOrdersLite.fetch(ooMaker);
      expect(makerOoAfter.active).toBe(false);
    }
  });
});
