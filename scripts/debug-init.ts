import * as anchor from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { fileURLToPath } from "url";
import path from "path";
import { KerdosClient, PublicKey, BN } from "../packages/kerdos-sdk/dist/index.js";

const PROGRAM_ID = new PublicKey("DjcqZWPwPaB6EwnMXNdcgxkFk26ub6t6FXdSDE7aK3Sb");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const client = await KerdosClient.connect(provider, PROGRAM_ID);

  const mintAuthority = (provider.wallet as any).payer as Keypair;
  const baseMint = await createMint(provider.connection, mintAuthority, mintAuthority.publicKey, null, 6);
  const quoteMint = await createMint(provider.connection, mintAuthority, mintAuthority.publicKey, null, 6);

  const pdas = client.derivePdas(baseMint, quoteMint, provider.wallet.publicKey);

  const bidsCapacity = 100;
  const asksCapacity = 100;
  const evqCapacity = 128;

  console.log("init market", { market: pdas.market.toBase58(), bids: pdas.bids.toBase58(), asks: pdas.asks.toBase58(), eventQueue: pdas.eventQueue.toBase58() });
  const sig = await client.program.methods
    .initMarket({
      baseMint,
      quoteMint,
      bidsCapacity,
      asksCapacity,
      eventQueueCapacity: evqCapacity,
      tickSize: new BN(10_000),
      minBaseQty: new BN(100),
      feesBps: 0,
    })
    .accounts({
      payer: provider.wallet.publicKey,
      authority: provider.wallet.publicKey,
      baseMint,
      quoteMint,
      market: pdas.market,
      bids: pdas.bids,
      asks: pdas.asks,
      eventQueue: pdas.eventQueue,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  console.log("initMarket sig", sig);

  const fetchInfo = async (pk: PublicKey) => {
    const acc = await provider.connection.getAccountInfo(pk);
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

  console.log("bids info", await fetchInfo(pdas.bids));
  console.log("asks info", await fetchInfo(pdas.asks));
  console.log("eventq info", await fetchInfo(pdas.eventQueue));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
