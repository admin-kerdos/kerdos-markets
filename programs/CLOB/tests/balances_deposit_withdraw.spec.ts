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
const program = (anchor.workspace as any).kerdos_markets as anchor.Program;

const SYS_PROG = anchor.web3.SystemProgram.programId;

function computeLimitIx(units: number) {
  return ComputeBudgetProgram.setComputeUnitLimit({ units });
}

function derivePDAs(programId: PublicKey, baseMint: PublicKey, quoteMint: PublicKey, user: PublicKey) {
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

async function airdropSOL(pubkey: PublicKey, lamports: number) {
  const sig = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction(sig);
}

describe("balances deposit/withdraw", () => {
  it("inits vaults/ub, deposits and withdraws base/quote", { timeout: 60000 }, async () => {
    await airdropSOL(provider.wallet.publicKey, 2 * LAMPORTS_PER_SOL);

    const mintAuthority = (provider.wallet as any).payer as Keypair;
    const baseMint = await createMint(provider.connection, mintAuthority, mintAuthority.publicKey, null, 6);
    const quoteMint = await createMint(provider.connection, mintAuthority, mintAuthority.publicKey, null, 6);

    const userBase = await getOrCreateAssociatedTokenAccount(provider.connection, mintAuthority, baseMint, provider.wallet.publicKey);
    const userQuote = await getOrCreateAssociatedTokenAccount(provider.connection, mintAuthority, quoteMint, provider.wallet.publicKey);

    await mintTo(provider.connection, mintAuthority, baseMint, userBase.address, mintAuthority, 1_000_000_000n);
    await mintTo(provider.connection, mintAuthority, quoteMint, userQuote.address, mintAuthority, 2_000_000_000n);

    const { market, bids, asks, eventQueue, oo, vaultAuth, baseVault, quoteVault, ub } =
      derivePDAs(program.programId, baseMint, quoteMint, provider.wallet.publicKey);

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

    const cuIx = computeLimitIx(1_200_000);

    await program.methods
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

    await program.methods
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

    await program.methods
      .initUserBalance()
      .accounts({
        payer: provider.wallet.publicKey,
        user: provider.wallet.publicKey,
        market,
        ub,
        systemProgram: SYS_PROG,
      })
      .rpc();

    const depBase = 250_000n;
    const depQuote = 400_000n;

    const preBaseUser = (await getAccount(provider.connection, userBase.address)).amount;
    const preQuoteUser = (await getAccount(provider.connection, userQuote.address)).amount;

    await program.methods
      .depositBase(new anchor.BN(Number(depBase)))
      .accounts({
        user: provider.wallet.publicKey,
        market,
        ub,
        userBaseAta: userBase.address,
        baseVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await program.methods
      .depositQuote(new anchor.BN(Number(depQuote)))
      .accounts({
        user: provider.wallet.publicKey,
        market,
        ub,
        userQuoteAta: userQuote.address,
        quoteVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const ubAfterDep = await (program.account as any).userBalance.fetch(ub);
    expect(BigInt(ubAfterDep.baseFree.toString())).toBe(depBase);
    expect(BigInt(ubAfterDep.quoteFree.toString())).toBe(depQuote);

    const midBaseUser = (await getAccount(provider.connection, userBase.address)).amount;
    const midQuoteUser = (await getAccount(provider.connection, userQuote.address)).amount;
    expect(preBaseUser - midBaseUser).toBe(depBase);
    expect(preQuoteUser - midQuoteUser).toBe(depQuote);

    const wdBase = 120_000n;
    const wdQuote = 150_000n;

    await program.methods
      .withdrawBase(new anchor.BN(Number(wdBase)))
      .accounts({
        user: provider.wallet.publicKey,
        market,
        ub,
        userBaseAta: userBase.address,
        baseVault,
        vaultAuth,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await program.methods
      .withdrawQuote(new anchor.BN(Number(wdQuote)))
      .accounts({
        user: provider.wallet.publicKey,
        market,
        ub,
        userQuoteAta: userQuote.address,
        quoteVault,
        vaultAuth,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const ubAfterWd = await (program.account as any).userBalance.fetch(ub);
    expect(BigInt(ubAfterWd.baseFree.toString())).toBe(depBase - wdBase);
    expect(BigInt(ubAfterWd.quoteFree.toString())).toBe(depQuote - wdQuote);

    const postBaseUser = (await getAccount(provider.connection, userBase.address)).amount;
    const postQuoteUser = (await getAccount(provider.connection, userQuote.address)).amount;
    expect(postBaseUser - midBaseUser).toBe(wdBase);
    expect(postQuoteUser - midQuoteUser).toBe(wdQuote);
  });
});
