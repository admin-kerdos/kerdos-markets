import * as anchor from "@coral-xyz/anchor";
import { KerdosClient, PublicKey, BN } from "@kerdos/sdk";
import {
  LAMPORTS_PER_SOL,
  Keypair,
  Signer,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

type WalletCtx = {
  keypair: Keypair;
  baseAta: PublicKey;
  quoteAta: PublicKey;
  pdas: ReturnType<KerdosClient["derivePdas"]>;
};

const PROGRAM_ID = new PublicKey("DjcqZWPwPaB6EwnMXNdcgxkFk26ub6t6FXdSDE7aK3Sb");

async function airdrop(
  provider: anchor.AnchorProvider,
  pubkey: PublicKey,
  lamports: number
) {
  const sig = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction(sig);
}

async function prepWallet(
  provider: anchor.AnchorProvider,
  client: KerdosClient,
  mintAuthority: Signer,
  baseMint: PublicKey,
  quoteMint: PublicKey
): Promise<WalletCtx> {
  const keypair = Keypair.generate();
  // Give each wallet a healthier SOL buffer so lock lamports never exhaust during stress.
  await airdrop(provider, keypair.publicKey, 10 * LAMPORTS_PER_SOL);

  const mintPerWallet = BigInt(Number(process.env.STRESS_MINT_TOKENS ?? 1_000_000_000));
  const baseAta = (await getOrCreateAssociatedTokenAccount(
    provider.connection,
    mintAuthority as Keypair,
    baseMint,
    keypair.publicKey
  )).address;
  const quoteAta = (await getOrCreateAssociatedTokenAccount(
    provider.connection,
    mintAuthority as Keypair,
    quoteMint,
    keypair.publicKey
  )).address;

  // Seed balances for both sides so wallet can buy/sell.
  await mintTo(provider.connection, mintAuthority as Keypair, baseMint, baseAta, mintAuthority, mintPerWallet);
  await mintTo(provider.connection, mintAuthority as Keypair, quoteMint, quoteAta, mintAuthority, mintPerWallet);

  const pdas = client.derivePdas(baseMint, quoteMint, keypair.publicKey);
  await client.initUserBalance({ baseMint, quoteMint, user: keypair.publicKey, userSigner: keypair });
  const depositBase = Number(process.env.STRESS_DEPOSIT_BASE ?? 500_000_000);
  const depositQuote = Number(process.env.STRESS_DEPOSIT_QUOTE ?? 500_000_000);
  await client.depositBase({
    baseMint,
    quoteMint,
    user: keypair.publicKey,
    userBaseAta: baseAta,
    amount: new BN(depositBase),
    userSigner: keypair,
  });
  await client.depositQuote({
    baseMint,
    quoteMint,
    user: keypair.publicKey,
    userQuoteAta: quoteAta,
    amount: new BN(depositQuote),
    userSigner: keypair,
  });

  return { keypair, baseAta, quoteAta, pdas };
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const client = await KerdosClient.connect(provider, PROGRAM_ID);

  // Keep defaults small enough to fit CPI realloc limits on localnet; override via env to test larger books.
  const bidsCap = Number(process.env.STRESS_BIDS_CAP ?? 64);
  const asksCap = Number(process.env.STRESS_ASKS_CAP ?? 64);
  const evqCap = Number(process.env.STRESS_EVENTQ_CAP ?? 128);
  const walletCount = Number(process.env.STRESS_WALLETS ?? 5);
  const ordersToSend = Number(process.env.STRESS_ORDERS ?? 200);
  const slippageTicks = Number(process.env.STRESS_SLIPPAGE_TICKS ?? 5_000);
  const groupSize = Number(process.env.STRESS_GROUP_SIZE ?? 10);
  const maxEvents = Number(process.env.STRESS_MAX_EVENTS ?? 1);
  const settleEvery = Number(process.env.STRESS_SETTLE_EVERY ?? 1);
  const lockLamports = new BN(Number(process.env.STRESS_LOCK_LAMPORTS ?? 100_000));

  const mintAuthority = (provider.wallet as any).payer as Keypair;
  const baseMint = await createMint(provider.connection, mintAuthority, mintAuthority.publicKey, null, 6);
  const quoteMint = await createMint(provider.connection, mintAuthority, mintAuthority.publicKey, null, 6);

  await client.initMarket({
    baseMint,
    quoteMint,
    bidsCapacity: bidsCap,
    asksCapacity: asksCap,
    eventQueueCapacity: evqCap,
    tickSize: new BN(10_000),
    minBaseQty: new BN(100),
    feesBps: 0,
    pre: 1_200_000,
  });
  await client.initVaults({ baseMint, quoteMint });

  // Ensure blobs reach the requested capacities with incremental grow instructions (each limited to ~10 KiB).
  const desiredBookLen = (cap: number) => 13 + 24 + 80 * cap; // Blob + SlabHeader + nodes
  const desiredEventLen = (cap: number) => 13 + 48 * cap; // Blob + FillEvent * cap
  const pdas = client.derivePdas(baseMint, quoteMint, (provider.wallet as any).publicKey);
  const readBlobInfo = async (pubkey: PublicKey) => {
    const acc = await provider.connection.getAccountInfo(pubkey);
    if (!acc) return null;
    const d = Buffer.from(acc.data);
    const magic = d.length >= 4 ? d.readUInt32LE(0) : 0;
    const kind = d.length >= 5 ? d.readUInt8(4) : 0;
    const cap = d.length >= 9 ? d.readUInt32LE(5) : 0;
    const used = d.length >= 13 ? d.readUInt32LE(9) : 0;
    let slabCap = 0;
    let slabUsed = 0;
    let slabFree = 0;
    let slabRoot = 0;
    let slabBest = 0;
    if (d.length >= 37) {
      slabCap = d.readUInt32LE(13);
      slabUsed = d.readUInt32LE(17);
      slabFree = d.readUInt32LE(21);
      slabRoot = d.readUInt32LE(25);
      slabBest = d.readUInt32LE(29);
    }
    return { len: d.length, magic, kind, cap, used, slabCap, slabUsed, slabFree, slabRoot, slabBest };
  };
  const growTo = async (which: 0 | 1 | 2, targetCap: number, targetLen: number, label: string) => {
    let attempts = 0;
    while (true) {
      const info = await readBlobInfo(which === 0 ? pdas.bids : which === 1 ? pdas.asks : pdas.eventQueue);
      if (info) {
        const capOk = which === 2 ? info.len >= targetLen : info.slabCap >= targetCap && info.len >= targetLen;
        if (capOk) {
          console.log(`${label} ready`, info);
          return;
        }
      }
      attempts++;
      if (attempts > 256) {
        throw new Error(`grow ${label} stuck after ${attempts} attempts`);
      }
      await client.growBlob({ baseMint, quoteMint, which, stepBytes: 10_000 });
    }
  };
  await growTo(0, bidsCap, desiredBookLen(bidsCap), "bids");
  await growTo(1, asksCap, desiredBookLen(asksCap), "asks");
  await growTo(2, evqCap, desiredEventLen(evqCap), "eventq");

  const wallets: WalletCtx[] = [];
  for (let i = 0; i < walletCount; i++) {
    wallets.push(await prepWallet(provider, client, mintAuthority, baseMint, quoteMint));
  }

  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  let placed = 0;
  const groups: WalletCtx[][] = [];
  for (let i = 0; i < wallets.length; i += groupSize) {
    groups.push(wallets.slice(i, i + groupSize));
  }
  const ordersPerGroup = Math.floor(ordersToSend / groups.length);
  const remainder = ordersToSend % groups.length;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const groupOrders = ordersPerGroup + (gi === groups.length - 1 ? remainder : 0);
    const oos: PublicKey[] = [];
    const ubs: PublicKey[] = [];
    for (const w of group) {
      oos.push(w.pdas.oo);
      ubs.push(w.pdas.ub);
    }

    for (let j = 0; j < groupOrders; j++) {
      const w = group[randInt(0, group.length - 1)];
      const side = randInt(0, 1) as 0 | 1;
      const qty = new BN(randInt(1, 5) * 100);
      const price = side === 0
        ? new BN(11_000 + randInt(0, 500)) // bids above mid
        : new BN(9_000 - randInt(0, 500)); // asks below mid

      try {
        const ooAcc = await client.fetchOpenOrders(w.pdas.oo);
        if (ooAcc.active) {
          await client.cancelOrder({
            baseMint,
            quoteMint,
            user: w.keypair.publicKey,
            userSigner: w.keypair,
          });
          const after = await client.fetchOpenOrders(w.pdas.oo);
          if (after.active) {
            process.stdout.write(`OO still active after cancel, skipping\n`);
            continue;
          }
        }
      } catch (_) {
        // OO doesn't exist yet; placeOrder will create it.
      }

      await client.placeOrder({
        baseMint,
        quoteMint,
        user: w.keypair.publicKey,
        priceTicks: price,
        baseQty: qty,
        side,
        lockLamports,
        maxSlippageTicks: new BN(slippageTicks),
        pre: 1_200_000,
        userSigner: w.keypair,
      });

      placed++;
      if (placed % settleEvery === 0) {
        await client.settleEvents({ baseMint, quoteMint, maxEvents, oos, ubs });
        process.stdout.write(`settled after ${placed} orders\n`);
      }
    }

    await client.settleEvents({ baseMint, quoteMint, maxEvents, oos, ubs });
  }

  for (const w of wallets) {
    const ub = await client.fetchUserBalance(w.pdas.ub);
    const baseFree = BigInt(ub.baseFree.toString());
    const quoteFree = BigInt(ub.quoteFree.toString());
    process.stdout.write(`wallet ${w.keypair.publicKey.toBase58()} base_free=${baseFree} quote_free=${quoteFree}\n`);
  }
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e));
  process.exit(1);
});
