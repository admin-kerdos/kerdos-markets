import anchorPkg, { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
import { PublicKey, Signer, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

type KerdosIdl = Idl & { name: "kerdos_markets" };
const idlPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./idl/kerdos_markets.json");
const idl = JSON.parse(readFileSync(idlPath, "utf8")) as KerdosIdl;

const SEEDS = {
  MARKET: Buffer.from("kerdos_market"),
  BIDS: Buffer.from("kerdos_bids"),
  ASKS: Buffer.from("kerdos_asks"),
  EVENTQ: Buffer.from("kerdos_eventq"),
  OO: Buffer.from("kerdos_oo"),
  VAULT_AUTH: Buffer.from("kerdos_vault_auth"),
  VAULT_BASE: Buffer.from("kerdos_vault_base"),
  VAULT_QUOTE: Buffer.from("kerdos_vault_quote"),
  USER: Buffer.from("kerdos_user"),
};

type PDAs = {
  market: PublicKey;
  bids: PublicKey;
  asks: PublicKey;
  eventQueue: PublicKey;
  oo: PublicKey;
  vaultAuth: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  ub: PublicKey;
};

export class KerdosClient {
  readonly program: Program<KerdosIdl>;
  readonly provider: AnchorProvider;
  readonly programId: PublicKey;

  private constructor(program: Program<KerdosIdl>) {
    this.program = program;
    this.provider = program.provider as AnchorProvider;
    this.programId = program.programId;
  }

  /**
   * Connects to the on-chain program using the bundled IDL.
   */
  static async connect(provider: AnchorProvider, programId: PublicKey) {
    const idlWithAddr = {
      ...(idl as any),
      metadata: { ...(idl as any).metadata, address: programId.toBase58() },
    };
    const program = new Program(idlWithAddr as KerdosIdl, provider) as Program<KerdosIdl>;
    return new KerdosClient(program);
  }

  /**
   * Compute all PDAs for a market/user tuple.
   */
  derivePdas(baseMint: PublicKey, quoteMint: PublicKey, user: PublicKey): PDAs {
    const market = PublicKey.findProgramAddressSync(
      [SEEDS.MARKET, baseMint.toBuffer(), quoteMint.toBuffer()],
      this.programId
    )[0];
    const bids = PublicKey.findProgramAddressSync([SEEDS.BIDS, market.toBuffer()], this.programId)[0];
    const asks = PublicKey.findProgramAddressSync([SEEDS.ASKS, market.toBuffer()], this.programId)[0];
    const eventQueue = PublicKey.findProgramAddressSync([SEEDS.EVENTQ, market.toBuffer()], this.programId)[0];
    const oo = PublicKey.findProgramAddressSync([SEEDS.OO, market.toBuffer(), user.toBuffer()], this.programId)[0];
    const vaultAuth = PublicKey.findProgramAddressSync([SEEDS.VAULT_AUTH, market.toBuffer()], this.programId)[0];
    const baseVault = PublicKey.findProgramAddressSync([SEEDS.VAULT_BASE, market.toBuffer()], this.programId)[0];
    const quoteVault = PublicKey.findProgramAddressSync([SEEDS.VAULT_QUOTE, market.toBuffer()], this.programId)[0];
    const ub = PublicKey.findProgramAddressSync([SEEDS.USER, market.toBuffer(), user.toBuffer()], this.programId)[0];
    return { market, bids, asks, eventQueue, oo, vaultAuth, baseVault, quoteVault, ub };
  }

  /**
   * Initializes a market and its book PDAs.
   */
  async initMarket(args: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    bidsCapacity: number;
    asksCapacity: number;
    eventQueueCapacity: number;
    tickSize: BN;
    minBaseQty: BN;
    feesBps: number;
    pre?: number;
  }) {
    const { baseMint, quoteMint } = args;
    const pdas = this.derivePdas(baseMint, quoteMint, this.provider.wallet.publicKey);
    const preIxs = [];
    if (args.pre && args.pre > 0) {
      preIxs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: args.pre }));
    }
    return this.program.methods
      .initMarket({
        baseMint,
        quoteMint,
        bidsCapacity: args.bidsCapacity,
        asksCapacity: args.asksCapacity,
        eventQueueCapacity: args.eventQueueCapacity,
        tickSize: args.tickSize,
        minBaseQty: args.minBaseQty,
        feesBps: args.feesBps,
      })
      .preInstructions(preIxs)
      .accounts({
        payer: this.provider.wallet.publicKey,
        authority: this.provider.wallet.publicKey,
        baseMint,
        quoteMint,
        market: pdas.market,
        bids: pdas.bids,
        asks: pdas.asks,
        eventQueue: pdas.eventQueue,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Grows one of the blobs (bids=0, asks=1, eventq=2) by stepBytes (capped in-program).
   */
  async growBlob(args: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    which: 0 | 1 | 2;
    stepBytes: number;
  }) {
    const { baseMint, quoteMint, which, stepBytes } = args;
    const pdas = this.derivePdas(baseMint, quoteMint, this.provider.wallet.publicKey);
    return this.program.methods
      .growBlob({ which, stepBytes })
      .accounts({
        payer: this.provider.wallet.publicKey,
        market: pdas.market,
        bids: pdas.bids,
        asks: pdas.asks,
        eventQueue: pdas.eventQueue,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Initializes vaults for a market.
   */
  async initVaults(args: { baseMint: PublicKey; quoteMint: PublicKey }) {
    const { baseMint, quoteMint } = args;
    const pdas = this.derivePdas(baseMint, quoteMint, this.provider.wallet.publicKey);
    return this.program.methods
      .initVaults()
      .accounts({
        payer: this.provider.wallet.publicKey,
        authority: this.provider.wallet.publicKey,
        market: pdas.market,
        baseMint,
        quoteMint,
        vaultAuth: pdas.vaultAuth,
        baseVault: pdas.baseVault,
        quoteVault: pdas.quoteVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();
  }

  /**
   * Initializes a user balance PDA for a given user.
   */
  async initUserBalance(args: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    user: PublicKey;
    userSigner: Signer;
  }) {
    const { baseMint, quoteMint, user, userSigner } = args;
    const pdas = this.derivePdas(baseMint, quoteMint, user);
    return this.program.methods
      .initUserBalance()
      .accounts({
        payer: this.provider.wallet.publicKey,
        user,
        market: pdas.market,
        ub: pdas.ub,
        systemProgram: SystemProgram.programId,
      })
      .signers([userSigner])
      .rpc();
  }

  /**
   * Deposits base tokens from the user's ATA into the market vault.
   */
  async depositBase(args: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    user: PublicKey;
    userBaseAta: PublicKey;
    amount: BN;
    userSigner: Signer;
  }) {
    const { baseMint, quoteMint, user, userBaseAta, amount, userSigner } = args;
    const pdas = this.derivePdas(baseMint, quoteMint, user);
    return this.program.methods
      .depositBase(amount)
      .accounts({
        user,
        market: pdas.market,
        ub: pdas.ub,
        userBaseAta,
        baseVault: pdas.baseVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([userSigner])
      .rpc();
  }

  /**
   * Deposits quote tokens from the user's ATA into the market vault.
   */
  async depositQuote(args: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    user: PublicKey;
    userQuoteAta: PublicKey;
    amount: BN;
    userSigner: Signer;
  }) {
    const { baseMint, quoteMint, user, userQuoteAta, amount, userSigner } = args;
    const pdas = this.derivePdas(baseMint, quoteMint, user);
    return this.program.methods
      .depositQuote(amount)
      .accounts({
        user,
        market: pdas.market,
        ub: pdas.ub,
        userQuoteAta,
        quoteVault: pdas.quoteVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([userSigner])
      .rpc();
  }

  /**
   * Places an order on the book.
   */
  async placeOrder(args: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    user: PublicKey;
    priceTicks: BN;
    baseQty: BN;
    side: 0 | 1;
    lockLamports: BN;
    maxSlippageTicks: BN;
    pre?: number;
    userSigner: Signer;
  }) {
    const { baseMint, quoteMint, user, userSigner } = args;
    const pdas = this.derivePdas(baseMint, quoteMint, user);
    const preIxs = [];
    if (args.pre && args.pre > 0) {
      preIxs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: args.pre }));
    }
    return this.program.methods
      .placeOrder({
        priceTicks: args.priceTicks,
        baseQty: args.baseQty,
        side: args.side,
        lockLamports: args.lockLamports,
        maxSlippageTicks: args.maxSlippageTicks,
      })
      .preInstructions(preIxs)
      .accounts({
        payer: user,
        market: pdas.market,
        bids: pdas.bids,
        asks: pdas.asks,
        eventQueue: pdas.eventQueue,
        oo: pdas.oo,
        systemProgram: SystemProgram.programId,
      })
      .signers([userSigner])
      .rpc();
  }

  /**
   * Settles fill events into user balances.
   */
  async settleEvents(args: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    maxEvents: number;
    oos: PublicKey[];
    ubs: PublicKey[];
  }) {
    const { baseMint, quoteMint, maxEvents, oos, ubs } = args;
    const pdas = this.derivePdas(baseMint, quoteMint, this.provider.wallet.publicKey);
    const remaining = [...oos, ...ubs].map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: true,
    }));
    return this.program.methods
      .settleEvents(maxEvents)
      .accounts({
        authority: this.provider.wallet.publicKey,
        market: pdas.market,
        eventQueue: pdas.eventQueue,
      })
      .remainingAccounts(remaining)
      .rpc();
  }

  /**
   * Fetches a user balance account.
   */
  async fetchUserBalance(ub: PublicKey) {
    return (this.program.account as any).userBalance.fetch(ub);
  }

  /**
   * Fetches an open orders account.
   */
  async fetchOpenOrders(oo: PublicKey) {
    return (this.program.account as any).openOrdersLite.fetch(oo);
  }

  /**
   * Cancels an open order if it exists.
   */
  async cancelOrder(args: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    user: PublicKey;
    userSigner: Signer;
  }) {
    const { baseMint, quoteMint, user, userSigner } = args;
    const pdas = this.derivePdas(baseMint, quoteMint, user);
    return this.program.methods
      .cancelOrder()
      .accounts({
        payer: user,
        market: pdas.market,
        bids: pdas.bids,
        asks: pdas.asks,
        oo: pdas.oo,
      })
      .signers([userSigner])
      .rpc();
  }
}

export { PublicKey } from "@solana/web3.js";
const { BN: AnchorBN } = anchorPkg as any;
export { AnchorBN as BN };
