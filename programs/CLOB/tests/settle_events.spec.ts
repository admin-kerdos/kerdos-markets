import { describe, it, expect } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import {
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const workspaceProgram = (anchor.workspace as any).kerdos_markets as anchor.Program;

const SYS_PROG = anchor.web3.SystemProgram.programId;

function computeLimitIx(units: number) {
  return ComputeBudgetProgram.setComputeUnitLimit({ units });
}

function pdas(
  programId: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  user: PublicKey
) {
  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_market"), baseMint.toBuffer(), quoteMint.toBuffer()],
    programId
  );
  const [bids] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_bids"), market.toBuffer()],
    programId
  );
  const [asks] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_asks"), market.toBuffer()],
    programId
  );
  const [eventQueue] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_eventq"), market.toBuffer()],
    programId
  );
  const [oo] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_oo"), market.toBuffer(), user.toBuffer()],
    programId
  );
  const [vaultAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_vault_auth"), market.toBuffer()],
    programId
  );
  const [baseVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_vault_base"), market.toBuffer()],
    programId
  );
  const [quoteVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_vault_quote"), market.toBuffer()],
    programId
  );
  const [ub] = PublicKey.findProgramAddressSync(
    [Buffer.from("kerdos_user"), market.toBuffer(), user.toBuffer()],
    programId
  );
  return { market, bids, asks, eventQueue, oo, vaultAuth, baseVault, quoteVault, ub };
}

async function airdrop(pubkey: PublicKey, lamports: number) {
  const sig = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction(sig);
}

describe("settle_events", () => {
  it(
    "matches maker/taker and settles internal balances",
    async () => {
      const maker = Keypair.generate();
      const taker = Keypair.generate();
      await airdrop(maker.publicKey, 2 * LAMPORTS_PER_SOL);
      await airdrop(taker.publicKey, 2 * LAMPORTS_PER_SOL);

      const mintAuthority = (provider.wallet as any).payer as Keypair;
      const baseMint = await createMint(
        provider.connection,
        mintAuthority,
        mintAuthority.publicKey,
        null,
        6
      );
      const quoteMint = await createMint(
        provider.connection,
        mintAuthority,
        mintAuthority.publicKey,
        null,
        6
      );

      const makerBase = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        mintAuthority,
        baseMint,
        maker.publicKey
      );
      const makerQuote = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        mintAuthority,
        quoteMint,
        maker.publicKey
      );
      const takerBase = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        mintAuthority,
        baseMint,
        taker.publicKey
      );
      const takerQuote = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        mintAuthority,
        quoteMint,
        taker.publicKey
      );

      await mintTo(
        provider.connection,
        mintAuthority,
        baseMint,
        makerBase.address,
        mintAuthority,
        1_000_000n
      );
      await mintTo(
        provider.connection,
        mintAuthority,
        quoteMint,
        takerQuote.address,
        mintAuthority,
        5_000_000n
      );

      const {
        market,
        bids,
        asks,
        eventQueue,
        oo: makerOo,
        vaultAuth,
        baseVault,
        quoteVault,
        ub: makerUb,
      } = pdas(workspaceProgram.programId, baseMint, quoteMint, maker.publicKey);
      const { oo: takerOo, ub: takerUb } = pdas(
        workspaceProgram.programId,
        baseMint,
        quoteMint,
        taker.publicKey
      );

      const initParams = {
        baseMint,
        quoteMint,
        bidsCapacity: 1024,
        asksCapacity: 1024,
        eventQueueCapacity: 512,
        tickSize: new anchor.BN(10_000),
        minBaseQty: new anchor.BN(100),
        feesBps: 0,
      };

      const cuIx = computeLimitIx(1_200_000);

      await workspaceProgram.methods
        .initMarket(initParams)
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

      await workspaceProgram.methods
        .initVaults()
        .accounts({
          payer: provider.wallet.publicKey,
          authority: provider.wallet.publicKey,
          market,
          baseMint,
          quoteMint,
          vaultAuth,
          baseVault,
          quoteVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYS_PROG,
        })
        .rpc();

    await workspaceProgram.methods
      .initUserBalance()
      .accounts({
        payer: provider.wallet.publicKey,
        user: maker.publicKey,
        market,
        ub: makerUb,
        systemProgram: SYS_PROG,
      })
      .signers([maker])              
      .rpc();

    await workspaceProgram.methods
      .initUserBalance()
      .accounts({
        payer: provider.wallet.publicKey,
        user: taker.publicKey,
        market,
        ub: takerUb,
        systemProgram: SYS_PROG,
      })
      .signers([taker])              
      .rpc();

      await workspaceProgram.methods
        .depositBase(new anchor.BN(500_000))
        .accounts({
          user: maker.publicKey,
          market,
          ub: makerUb,
          userBaseAta: makerBase.address,
          baseVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([maker])
        .rpc();

      await workspaceProgram.methods
        .depositQuote(new anchor.BN(2_000_000))
        .accounts({
          user: taker.publicKey,
          market,
          ub: takerUb,
          userQuoteAta: takerQuote.address,
          quoteVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([taker])
        .rpc();

      const makerUbBefore = await (workspaceProgram.account as any).userBalance.fetch(makerUb);
      const takerUbBefore = await (workspaceProgram.account as any).userBalance.fetch(takerUb);

      await workspaceProgram.methods
        .placeOrder({
          priceTicks: new anchor.BN(10_000),
          baseQty: new anchor.BN(100),
          side: 1,
          lockLamports: new anchor.BN(1000),
          maxSlippageTicks: new anchor.BN(0),
        })
        .accounts({
          payer: maker.publicKey,
          market,
          bids,
          asks,
          eventQueue,
          oo: makerOo,
          systemProgram: SYS_PROG,
        })
        .signers([maker])
        .rpc();

      await workspaceProgram.methods
        .placeOrder({
          priceTicks: new anchor.BN(10_000),
          baseQty: new anchor.BN(100),
          side: 0,
          lockLamports: new anchor.BN(1000),
          maxSlippageTicks: new anchor.BN(0),
        })
        .accounts({
          payer: taker.publicKey,
          market,
          bids,
          asks,
          eventQueue,
          oo: takerOo,
          systemProgram: SYS_PROG,
        })
        .signers([taker])
        .rpc();

      await workspaceProgram.methods
        .settleEvents(1000)
        .accounts({
          authority: provider.wallet.publicKey,
          market,
          eventQueue,
        })
        .remainingAccounts([
          { pubkey: makerOo, isSigner: false, isWritable: false },
          { pubkey: takerOo, isSigner: false, isWritable: false },
          { pubkey: makerUb, isSigner: false, isWritable: true },
          { pubkey: takerUb, isSigner: false, isWritable: true },
        ])
        .rpc();

      const makerUbAfter = await (workspaceProgram.account as any).userBalance.fetch(makerUb);
      const takerUbAfter = await (workspaceProgram.account as any).userBalance.fetch(takerUb);

      expect(BigInt(makerUbAfter.baseFree.toString())).toBe(
        BigInt(makerUbBefore.baseFree.toString()) - 100n
      );
      expect(BigInt(makerUbAfter.quoteFree.toString())).toBe(
        BigInt(makerUbBefore.quoteFree.toString()) + 1_000_000n
      );
      expect(BigInt(takerUbAfter.baseFree.toString())).toBe(
        BigInt(takerUbBefore.baseFree.toString()) + 100n
      );
      expect(BigInt(takerUbAfter.quoteFree.toString())).toBe(
        BigInt(takerUbBefore.quoteFree.toString()) - 1_000_000n
      );
    },
    60_000
  );
});
