import { randomUUID } from "crypto";
import type { WalletProvider } from "./store";

export type ChallengeRecord = {
  nonce: string;
  challenge: string;
  publicKey: string;
  walletType: WalletProvider;
  expiresAt: number;
  used: boolean;
};

const DEFAULT_TTL = 60_000;
const records = new Map<string, ChallengeRecord>();

function ttl(): number {
  const raw = process.env.SIWS_CHALLENGE_TTL_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TTL;
  }
  return parsed;
}

function cleanup(now = Date.now()) {
  for (const [nonce, record] of records) {
    if (record.expiresAt <= now || record.used) {
      records.delete(nonce);
    }
  }
}

export function createChallenge(publicKey: string, walletType: WalletProvider): ChallengeRecord {
  cleanup();
  const nonce = randomUUID();
  const issuedAt = Date.now();
  const body = [
    "Kérdos Markets — Inicio de sesión con Solana.",
    `Wallet: ${walletType}`,
    `Dirección: ${publicKey}`,
    `Nonce: ${nonce}`,
    `Emitido: ${new Date(issuedAt).toISOString()}`,
    "",
    "Firma este mensaje para confirmar que controlas la cuenta."
  ].join("\n");

  const record: ChallengeRecord = {
    nonce,
    challenge: body,
    publicKey,
    walletType,
    expiresAt: issuedAt + ttl(),
    used: false
  };

  records.set(nonce, record);
  return record;
}

export function getChallenge(nonce: string): ChallengeRecord | null {
  cleanup();
  const record = records.get(nonce);
  if (!record) return null;
  if (record.expiresAt <= Date.now() || record.used) {
    records.delete(nonce);
    return null;
  }
  return record;
}

export function markChallengeUsed(nonce: string) {
  const record = records.get(nonce);
  if (!record) return;
  record.used = true;
  records.set(nonce, record);
}
