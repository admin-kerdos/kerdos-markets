import BN from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import { KerdosClient, PublicKey } from "@kerdos/sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type MarketsFile = {
  markets: Array<{
    slug: string;
    yesMint?: string;
    multiOption?: boolean;
    options?: Array<{ yesMint: string }>;
    quoteMint: string;
    tickSize: number;
    minBaseQty: number;
    feesBps: number;
  }>;
};

async function readMarkets(): Promise<MarketsFile> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const jsonPath = path.resolve(__dirname, "../app/data/markets.local.json");
  const raw = await fs.readFile(jsonPath, "utf8");
  return JSON.parse(raw) as MarketsFile;
}

async function getProvider(): Promise<anchor.AnchorProvider> {
  const url =
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "http://127.0.0.1:8899";
  const walletPath =
    process.env.ANCHOR_WALLET ||
    `${process.env.HOME}/.config/solana/id.json`;

  const secret = new Uint8Array(JSON.parse(await fs.readFile(walletPath, "utf8")));
  const kp = anchor.web3.Keypair.fromSecretKey(secret);
  const conn = new anchor.web3.Connection(url, "confirmed");
  const wallet = new anchor.Wallet(kp);
  return new anchor.AnchorProvider(conn, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

async function main() {
  const provider = await getProvider();
  anchor.setProvider(provider);

  const programId = new PublicKey(
    process.env.NEXT_PUBLIC_KERDOS_PROGRAM_ID ??
      "DjcqZWPwPaB6EwnMXNdcgxkFk26ub6t6FXdSDE7aK3Sb"
  );
  const client = await KerdosClient.connect(provider, programId);

  const data = await readMarkets();

  for (const m of data.markets) {
    const baseMintAddress =
      (m.multiOption && m.options && m.options[0] && m.options[0].yesMint) || m.yesMint;
    if (!baseMintAddress) {
      console.warn(`Skipping ${m.slug}: no base mint configured`);
      continue;
    }
    const baseMint = new PublicKey(baseMintAddress);
    const quoteMint = new PublicKey(m.quoteMint);

    const sig1 = await client.initMarket({
      baseMint,
      quoteMint,
      bidsCapacity: 1024,
      asksCapacity: 1024,
      eventQueueCapacity: 512,
      tickSize: new BN(m.tickSize),
      minBaseQty: new BN(m.minBaseQty),
      feesBps: m.feesBps,
      pre: 1_200_000,
    });
    console.log(`${m.slug}: initMarket ${sig1}`);

    const sig2 = await client.initVaults({ baseMint, quoteMint });
    console.log(`${m.slug}: initVaults ${sig2}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
