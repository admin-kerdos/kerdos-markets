import { randomUUID } from "crypto";

export type ProviderKind = "google" | "wallet" | "email";
export type WalletProvider = "phantom" | "solflare";

export type AuthUserRecord = {
  id: string;
  provider: ProviderKind;
  name: string;
  email: string | null;
  image: string | null;
  publicKey: string | null;
  walletType: WalletProvider | null;
  createdAt: string;
};

type GoogleProfile = {
  email: string;
  name: string;
  image?: string | null;
};

type EmailProfile = {
  email: string;
  name?: string | null;
};

type WalletProfile = {
  publicKey: string;
  walletType: WalletProvider;
  name?: string | null;
  image?: string | null;
};

const usersById = new Map<string, AuthUserRecord>();
const emailIndex = new Map<string, string>();
const publicKeyIndex = new Map<string, string>();

function buildRecord(partial: Partial<AuthUserRecord> & { provider: ProviderKind }): AuthUserRecord {
  const id = partial.id ?? randomUUID();
  return {
    id,
    provider: partial.provider,
    name: partial.name ?? "Usuario",
    email: partial.email ?? null,
    image: partial.image ?? null,
    publicKey: partial.publicKey ?? null,
    walletType: partial.walletType ?? null,
    createdAt: partial.createdAt ?? new Date().toISOString()
  };
}

export function findUserById(id: string): AuthUserRecord | null {
  return usersById.get(id) ?? null;
}

export function findUserByEmail(email?: string | null): AuthUserRecord | null {
  if (!email) return null;
  const id = emailIndex.get(email.toLowerCase());
  return id ? findUserById(id) : null;
}

export function findUserByPublicKey(publicKey?: string | null): AuthUserRecord | null {
  if (!publicKey) return null;
  const id = publicKeyIndex.get(publicKey);
  return id ? findUserById(id) : null;
}

export function upsertGoogleUser(profile: GoogleProfile): AuthUserRecord {
  const existing = findUserByEmail(profile.email);
  if (existing) {
    const updated = { ...existing, name: profile.name, image: profile.image ?? existing.image };
    usersById.set(updated.id, updated);
    return updated;
  }

  const record = buildRecord({
    provider: "google",
    name: profile.name,
    email: profile.email,
    image: profile.image ?? null
  });
  usersById.set(record.id, record);
  emailIndex.set(profile.email.toLowerCase(), record.id);
  return record;
}

export function upsertEmailUser(profile: EmailProfile): AuthUserRecord {
  const existing = findUserByEmail(profile.email);
  if (existing) {
    const updated: AuthUserRecord = {
      ...existing,
      provider: "email",
      name: profile.name ?? existing.name
    };
    usersById.set(updated.id, updated);
    return updated;
  }

  const record = buildRecord({
    provider: "email",
    name: profile.name ?? profile.email,
    email: profile.email,
    image: null
  });
  usersById.set(record.id, record);
  emailIndex.set(profile.email.toLowerCase(), record.id);
  return record;
}

export function upsertWalletUser(profile: WalletProfile): AuthUserRecord {
  const existing = findUserByPublicKey(profile.publicKey);
  const defaultName = `Wallet ${profile.walletType === "phantom" ? "Phantom" : "Solflare"}`;
  if (existing) {
    const updated = {
      ...existing,
      name: profile.name ?? defaultName,
      walletType: profile.walletType,
      image: profile.image ?? existing.image
    };
    usersById.set(updated.id, updated);
    return updated;
  }

  const record = buildRecord({
    provider: "wallet",
    name: profile.name ?? defaultName,
    publicKey: profile.publicKey,
    walletType: profile.walletType,
    image: profile.image ?? null
  });
  usersById.set(record.id, record);
  publicKeyIndex.set(profile.publicKey, record.id);
  return record;
}

export function maskEmail(email?: string | null): string {
  if (!email) return "";
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  return `${user.slice(0, 2)}****@${domain}`;
}

export function maskPublicKey(publicKey?: string | null): string {
  if (!publicKey) return "";
  if (publicKey.length <= 8) return `${publicKey.slice(0, 2)}**${publicKey.slice(-2)}`;
  return `${publicKey.slice(0, 4)}****${publicKey.slice(-4)}`;
}
