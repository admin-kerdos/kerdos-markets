import "dotenv/config";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { KerdosClient } from "@kerdos/sdk";

type SeedDef = {
  slug: string;
  title: string;
  subtitle?: string;
  tickSize: number;
  minBaseQty: number;
  feesBps: number;
};

const defs: SeedDef[] = [
  { slug: "cr-elecciones-ganador-2026", title: "¿Quién ganará las elecciones presidenciales CR 2026?", tickSize: 10_000, minBaseQty: 100, feesBps: 0 },
  { slug: "sol-ath-2025",                title: "¿Solana hace ATH en 2025?",                                   tickSize: 10_000, minBaseQty: 100, feesBps: 0 },
  { slug: "btc-below-70k-2025",         title: "¿BTC caerá por debajo de $70k en 2025?",                      tickSize: 10_000, minBaseQty: 100, feesBps: 0 },
  { slug: "inflacion-cr-2025-menor-2",  title: "¿Inflación CR 2025 < 2%?",                                     tickSize: 10_000, minBaseQty: 100, feesBps: 0 },
];

async function getProvider(): Promise<anchor.AnchorProvider> {
  const endpoint =
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "http://127.0.0.1:8899";

  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config/solana/id.json");

  const secret = JSON.parse(await fs.readFile(walletPath, "utf8"));
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
  const conn = new Connection(endpoint, "confirmed");
  return new anchor.AnchorProvider(conn, new anchor.Wallet(kp), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

async function main() {
  const provider = await getProvider();
  anchor.setProvider(provider);
  const wallet = (provider.wallet as any).payer as Keypair;
  const programId = new PublicKey(
    process.env.NEXT_PUBLIC_KERDOS_PROGRAM_ID ??
      "DjcqZWPwPaB6EwnMXNdcgxkFk26ub6t6FXdSDE7aK3Sb"
  );
  const client = await KerdosClient.connect(provider, programId);
  const quoteMint = await createMint(provider.connection, wallet, wallet.publicKey, null, 6);

  const markets: any[] = [];
  for (const d of defs) {
    const yesMint = await createMint(provider.connection, wallet, wallet.publicKey, null, 6);
    const noMint  = await createMint(provider.connection, wallet, wallet.publicKey, null, 6);

    for (const [baseMint, label] of [
      [yesMint, "YES"],
      [noMint, "NO"],
    ] as const) {
      const sigMarket = await client.initMarket({
        baseMint,
        quoteMint,
        bidsCapacity: 1024,
        asksCapacity: 1024,
        eventQueueCapacity: 512,
        tickSize: new BN(d.tickSize),
        minBaseQty: new BN(d.minBaseQty),
        feesBps: d.feesBps,
        pre: 1_200_000,
      });
      console.log(`${d.slug} (${label}): initMarket ${sigMarket}`);

      const sigVaults = await client.initVaults({ baseMint, quoteMint });
      console.log(`${d.slug} (${label}): initVaults ${sigVaults}`);
    }

    markets.push({
      slug: d.slug,
      title: d.title,
      subtitle: d.subtitle ?? "",
      yesMint: yesMint.toBase58(),
      noMint:  noMint.toBase58(),
      quoteMint: quoteMint.toBase58(),
      tickSize: d.tickSize,
      minBaseQty: d.minBaseQty,
      feesBps: d.feesBps,
      rules: [],
      summary: "Contrato binario Sí/No",
      resolvesAt: ""
    });
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(here, "../app/data/markets.local.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({ markets }, null, 2), "utf8");
  console.log("Wrote", outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
