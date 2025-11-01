import * as anchor from "@coral-xyz/anchor";
import { KerdosClient, PublicKey } from "@kerdos/sdk";
import BN from "bn.js";
import {
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
type BNType = BN;

/**
 * Runs an end-to-end localnet demo: create market, init vaults and user balances,
 * deposit base/quote, place cross orders, settle events and print balances.
 */
async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const PROGRAM_ID = new PublicKey("DjcqZWPwPaB6EwnMXNdcgxkFk26ub6t6FXdSDE7aK3Sb");
  const client = await KerdosClient.connect(provider, PROGRAM_ID);

  const maker = Keypair.generate();
  const taker = Keypair.generate();

  await airdrop(provider, maker.publicKey, 2 * LAMPORTS_PER_SOL);
  await airdrop(provider, taker.publicKey, 2 * LAMPORTS_PER_SOL);

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

  await client.initMarket({
    baseMint,
    quoteMint,
    bidsCapacity: 1024,
    asksCapacity: 1024,
    eventQueueCapacity: 512,
    tickSize: new BN(10_000),
    minBaseQty: new BN(100),
    feesBps: 0,
    pre: 1_200_000,
  });

  await client.initVaults({ baseMint, quoteMint });

  await client.initUserBalance({ baseMint, quoteMint, user: maker.publicKey, userSigner: maker });
  await client.initUserBalance({ baseMint, quoteMint, user: taker.publicKey, userSigner: taker });

  await client.depositBase({
    baseMint,
    quoteMint,
    user: maker.publicKey,
    userBaseAta: makerBase.address,
    amount: new BN(500_000),
    userSigner: maker,
  });
  await client.depositQuote({
    baseMint,
    quoteMint,
    user: taker.publicKey,
    userQuoteAta: takerQuote.address,
    amount: new BN(2_000_000),
    userSigner: taker,
  });

  const makerPdas = client.derivePdas(baseMint, quoteMint, maker.publicKey);
  const takerPdas = client.derivePdas(baseMint, quoteMint, taker.publicKey);

  await client.placeOrder({
    baseMint,
    quoteMint,
    user: maker.publicKey,
    priceTicks: new BN(10_000),
    baseQty: new BN(100),
    side: 1,
    lockLamports: new BN(1000),
    maxSlippageTicks: new BN(0),
    pre: 1_000_000,
    userSigner: maker,
  });

  await client.placeOrder({
    baseMint,
    quoteMint,
    user: taker.publicKey,
    priceTicks: new BN(10_000),
    baseQty: new BN(100),
    side: 0,
    lockLamports: new BN(1000),
    maxSlippageTicks: new BN(0),
    pre: 1_000_000,
    userSigner: taker,
  });

  await client.settleEvents({
    baseMint,
    quoteMint,
    maxEvents: 1000,
    oos: [makerPdas.oo, takerPdas.oo],
    ubs: [makerPdas.ub, takerPdas.ub],
  });

  const makerUb = await client.fetchUserBalance(makerPdas.ub);
  const takerUb = await client.fetchUserBalance(takerPdas.ub);

  printBalances("maker", makerUb.baseFree, makerUb.quoteFree);
  printBalances("taker", takerUb.baseFree, takerUb.quoteFree);
}

async function airdrop(
  provider: anchor.AnchorProvider,
  pubkey: PublicKey,
  lamports: number
) {
  const sig = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction(sig);
}

function printBalances(label: string, base: BNType, quote: BNType) {
  const b = BigInt(base.toString());
  const q = BigInt(quote.toString());
  process.stdout.write(`${label} base_free=${b} quote_free=${q}\n`);
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e));
  process.exit(1);
});
