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
  const [oo] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_oo"), market.toBuffer(), provider.wallet.publicKey.toBuffer()],
    programId
  );
  return { market, bids, asks, eventQueue, oo };
}

async function airdropSOL(pubkey: anchor.web3.PublicKey, lamports: number) {
  const sig = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction(sig);
}

describe("clear_eventq + close_oo", () => {
  it("resets eventq used and closes OO to payer", async () => {
    await airdropSOL(provider.wallet.publicKey, 2 * LAMPORTS_PER_SOL);

    const baseMint = Keypair.generate().publicKey;
    const quoteMint = Keypair.generate().publicKey;
    const { market, bids, asks, eventQueue, oo } = derivePDAs(
      program.programId,
      baseMint,
      quoteMint
    );

    await program.methods
      .initMarket({
        baseMint,
        quoteMint,
        bidsCapacity: 1024,
        asksCapacity: 1024,
        eventQueueCapacity: 512,
        tickSize: new anchor.BN(10_000),
        minBaseQty: new anchor.BN(100),
        feesBps: 10,
      })
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

    const lock = Math.floor(0.02 * LAMPORTS_PER_SOL);
    await program.methods
      .placeOrder({
        priceTicks: new anchor.BN(10_000),
        baseQty: new anchor.BN(100),
        side: 0,
        lockLamports: new anchor.BN(lock),
        maxSlippageTicks: new anchor.BN(0),
      })
      .accounts({
        payer: provider.wallet.publicKey,
        market,
        bids,
        asks,
        eventQueue,
        oo,
        systemProgram: SYS_PROG,
      })
      .rpc();

    await program.methods
      .cancelOrder()
      .accounts({
        payer: provider.wallet.publicKey,
        market,
        oo,
      })
      .rpc();

    await program.methods
      .closeOo()
      .accounts({
        payer: provider.wallet.publicKey,
        market,
        oo,
      })
      .rpc();

    const ooBalAfter = await provider.connection.getBalance(oo);
    expect(ooBalAfter).toBe(0);

    await program.methods
      .clearEventq()
      .accounts({
        authority: provider.wallet.publicKey,
        market,
        eventQueue,
      })
      .rpc();
  });
});
