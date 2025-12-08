import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import { createChallenge, getChallenge, markChallengeUsed } from "../../src/lib/auth/challenges.js";
import { upsertWalletUser, findUserByPublicKey } from "../../src/lib/auth/store.js";
import { verifySignature } from "../../src/lib/auth/solana.js";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

test("createChallenge returns unique nonce and challenge", () => {
  const record = createChallenge("TestPublicKey", "phantom");
  assert.ok(record.nonce.length > 0);
  assert.ok(record.challenge.includes("Nonce:"));
  const stored = getChallenge(record.nonce);
  assert.equal(stored?.nonce, record.nonce);
  assert.equal(stored?.publicKey, "TestPublicKey");
  assert.equal(stored?.walletType, "phantom");
});

test("challenge cannot be reused after markChallengeUsed", () => {
  const record = createChallenge("ReusePublicKey", "solflare");
  assert.ok(getChallenge(record.nonce));
  markChallengeUsed(record.nonce);
  assert.equal(getChallenge(record.nonce), null);
});

test("challenge expires after configured TTL", async () => {
  process.env.SIWS_CHALLENGE_TTL_MS = "25";
  const record = createChallenge("ExpiryKey", "phantom");
  assert.ok(getChallenge(record.nonce));
  await delay(40);
  assert.equal(getChallenge(record.nonce), null);
  delete process.env.SIWS_CHALLENGE_TTL_MS;
});

test("verifySignature rejects invalid data", () => {
  const result = verifySignature("hola", "ZmFrZS1zaWduYXR1cmU=", "FakeKey");
  assert.deepEqual(result, { ok: false, error: "invalid_input" });
});

test("wallet user upsert stores and retrieves", () => {
  const keypair = Keypair.generate();
  const record = upsertWalletUser({
    publicKey: keypair.publicKey.toBase58(),
    walletType: "phantom",
    name: "Wallet Phantom"
  });
  const fetched = findUserByPublicKey(keypair.publicKey.toBase58());
  assert.equal(fetched?.id, record.id);
  assert.equal(fetched?.walletType, "phantom");
});

test("verifySignature authenticates valid ed25519 signature", () => {
  const keypair = Keypair.generate();
  const message = new TextEncoder().encode("mensaje de prueba");
  const signature = nacl.sign.detached(message, keypair.secretKey);
  const base64Signature = Buffer.from(signature).toString("base64");
  const result = verifySignature(
    new TextDecoder().decode(message),
    base64Signature,
    keypair.publicKey.toBase58()
  );
  assert.deepEqual(result, { ok: true });
});
