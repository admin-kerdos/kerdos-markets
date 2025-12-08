import { describe, it, expect } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import {
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  Keypair,
} from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";

const baseProvider = anchor.AnchorProvider.env();

const SYS_PROG = anchor.web3.SystemProgram.programId;

function computeLimitIx(units: number) {
  return ComputeBudgetProgram.setComputeUnitLimit({ units });
}

function derivePDAs(
  programId: anchor.web3.PublicKey,
  baseMint: anchor.web3.PublicKey,
  quoteMint: anchor.web3.PublicKey,
  ooOwner: anchor.web3.PublicKey
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
    [Buffer.from("kerdos_oo"), market.toBuffer(), ooOwner.toBuffer()],
    programId
  );
  return { market, bids, asks, eventQueue, oo };
}

async function confirmTx(
  conn: anchor.web3.Connection,
  sig: string,
  commitment: Commitment = "confirmed"
) {
  const latest = await conn.getLatestBlockhash(commitment);
  await conn.confirmTransaction({ signature: sig, ...latest }, commitment);
}

async function airdropSOL(conn: anchor.web3.Connection, pubkey: anchor.web3.PublicKey, lamports: number) {
  const sig = await conn.requestAirdrop(pubkey, lamports);
  await confirmTx(conn, sig, "confirmed");
}

const getBal = async (
  conn: anchor.web3.Connection,
  pk: anchor.web3.PublicKey
) => BigInt(await conn.getBalance(pk, "confirmed"));

describe("place/cancel without matching", () => {
  it("locks lamports then refunds on cancel", { timeout: 30000 }, async () => {
    const user = Keypair.generate();
  const userWallet = new anchor.Wallet(user);
  const userProvider = new anchor.AnchorProvider(
    baseProvider.connection,
    userWallet,
    { ...baseProvider.opts, commitment: "confirmed", preflightCommitment: "confirmed" }
  );

    const prev = anchor.getProvider();
    anchor.setProvider(userProvider);
    try {
      const program = (anchor.workspace as any)
        .kerdos_markets as anchor.Program;

      await airdropSOL(userProvider.connection, user.publicKey, 2 * LAMPORTS_PER_SOL);
      console.log("airdrop ok");

      const baseMint = Keypair.generate().publicKey;
      const quoteMint = Keypair.generate().publicKey;

      const { market, bids, asks, eventQueue, oo } = derivePDAs(
        program.programId,
        baseMint,
        quoteMint,
        user.publicKey
      );

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

      const cuIx = computeLimitIx(1_400_000);

      const initSig = await program.methods
        .initMarket(initParams)
        .preInstructions([cuIx])
        .accounts({
          payer: user.publicKey,
          authority: user.publicKey,
          baseMint,
          quoteMint,
          market,
          bids,
          asks,
          eventQueue,
          systemProgram: SYS_PROG,
        })
        .rpc();
      await confirmTx(userProvider.connection, initSig, "confirmed");
      console.log("initMarket ok", initSig);

      const preUser = await getBal(userProvider.connection, user.publicKey);

      const bnLamportsPerSol = BigInt(LAMPORTS_PER_SOL);
      const lock = (bnLamportsPerSol * 5n) / 100n; // 0.05 SOL

      const placeSig = await program.methods
        .placeOrder({
          priceTicks: new anchor.BN(10_000),
          baseQty: new anchor.BN(100),
          side: 0, // bid
          lockLamports: new anchor.BN(Number(lock)),
          maxSlippageTicks: new anchor.BN(0),
        })
        .accounts({
          payer: user.publicKey,
          market,
          bids,
          asks,
          eventQueue,
          oo,
          systemProgram: SYS_PROG,
        })
        .rpc();
      await confirmTx(userProvider.connection, placeSig, "confirmed");
      console.log("placeOrder ok", placeSig);

      const midUser = await getBal(userProvider.connection, user.publicKey);

      const SPACE_OO = 104;
      const rentOO = BigInt(
        await userProvider.connection.getMinimumBalanceForRentExemption(SPACE_OO)
      );
      const ooBalBefore = await getBal(userProvider.connection, oo);

      expect(ooBalBefore).toBe(rentOO + lock);
      expect(preUser > midUser).toBe(true);

      const ooAccAfterPlace = await (program.account as any).openOrdersLite.fetch(oo);
      expect(ooAccAfterPlace.active).toBe(true);
      expect(BigInt(ooAccAfterPlace.lockedLamports.toString())).toBe(lock);

      const cancelSig = await program.methods
        .cancelOrder()
        .accounts({
          payer: user.publicKey,
          market,
          oo,
        })
        .rpc();
      await confirmTx(userProvider.connection, cancelSig, "confirmed");
      console.log("cancelOrder ok", cancelSig);

      const postUser = await getBal(userProvider.connection, user.publicKey);
      const ooBalAfter = await getBal(userProvider.connection, oo);
      const ooAccAfterCancel = await (program.account as any).openOrdersLite.fetch(oo);

      expect(ooBalAfter).toBe(rentOO);
      expect(ooAccAfterCancel.active).toBe(false);
      expect(BigInt(ooAccAfterCancel.lockedLamports.toString())).toBe(0n);

      const refunded = ooBalBefore - ooBalAfter;
      expect(refunded).toBe(lock);

      const actualFee = (midUser + refunded) - postUser;
      expect(actualFee >= 0n).toBe(true);

      const cancelTx = await userProvider.connection.getTransaction(cancelSig, {
        maxSupportedTransactionVersion: 0,
        commitment: "finalized",
      });
      if (cancelTx?.meta?.fee !== undefined) {
        const rpcBase = BigInt(cancelTx.meta.fee);
        const rpcPrior = BigInt((cancelTx.meta as any)?.prioritizationFee ?? 0);
        expect(actualFee >= rpcBase).toBe(true);
        const DIFF_CAP = 10_000_000n; 
        expect(actualFee - (rpcBase + rpcPrior) <= DIFF_CAP).toBe(true);
      }
    } finally {
      anchor.setProvider(prev);
    }
  });
});
