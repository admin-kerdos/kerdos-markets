import { NextAuth } from "@auth/nextjs";
import Google from "@auth/core/providers/google";
import Email from "@auth/core/providers/email";
import Credentials from "@auth/core/providers/credentials";
import type { NextAuthConfig } from "@auth/nextjs";

import { getChallenge, markChallengeUsed } from "@/lib/auth/challenges";
import { verifySignature } from "@/lib/auth/solana";
import {
  maskEmail,
  maskPublicKey,
  upsertEmailUser,
  upsertGoogleUser,
  upsertWalletUser,
  type WalletProvider
} from "@/lib/auth/store";
import { serverEnv } from "@/lib/env/server";

const normalizeFlag = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const emailProviderEnabled = normalizeFlag(process.env.EMAIL_PROVIDER_ENABLED) || normalizeFlag(process.env.NEXT_PUBLIC_EMAIL_PROVIDER_ENABLED);

const providers: NextAuthConfig["providers"] = [
  Google({
    clientId: serverEnv.GOOGLE_CLIENT_ID,
    clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
    authorization: {
      params: {
        scope: "openid email profile",
        prompt: "consent",
        access_type: "offline",
        response_type: "code"
      }
    },
    profile(profile) {
      const name = profile.name ?? profile.email ?? "Usuario";
      if (profile.email) {
        upsertGoogleUser({
          email: profile.email,
          name,
          image: profile.picture ?? null
        });
      }
      return {
        id: profile.sub,
        name,
        email: profile.email,
        image: profile.picture,
        provider: "google"
      };
    }
  }),
  Credentials({
    id: "solana",
    name: "Solana Wallet",
    credentials: {
      publicKey: { label: "PublicKey", type: "text" },
      signature: { label: "Signature", type: "text" },
      nonce: { label: "Nonce", type: "text" },
      walletType: { label: "Wallet", type: "text" }
    },
    async authorize(credentials) {
      const publicKey = credentials?.publicKey as string | undefined;
      const signature = credentials?.signature as string | undefined;
      const nonce = credentials?.nonce as string | undefined;
      const walletType = credentials?.walletType as WalletProvider | undefined;

      if (!publicKey || !signature || !nonce || !walletType) {
        return null;
      }

      const stored = getChallenge(nonce);
      if (!stored) {
        return null;
      }

      if (stored.publicKey !== publicKey || stored.walletType !== walletType) {
        return null;
      }

      const verification = verifySignature(stored.challenge, signature, publicKey);
      if (!verification.ok) {
        return null;
      }

      markChallengeUsed(nonce);

      const record = upsertWalletUser({
        publicKey,
        walletType,
        name: `Wallet ${walletType === "phantom" ? "Phantom" : "Solflare"}`
      });

      return {
        id: record.id,
        name: record.name,
        email: record.email,
        image: record.image,
        publicKey: record.publicKey,
        walletType: record.walletType,
        provider: "wallet"
      };
    }
  })
];

if (emailProviderEnabled) {
  const emailFrom = process.env.EMAIL_FROM ?? "soporte@kerdos.xyz";
  providers.push(
    Email({
      from: emailFrom,
      async sendVerificationRequest({ identifier, url }) {
        console.info("[auth] Email magic link", maskEmail(identifier), url);
      }
    })
  );
}

export const authConfig: NextAuthConfig = {
  secret: serverEnv.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  trustHost: true,
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "email" && user?.email) {
        const record = upsertEmailUser({
          email: user.email,
          name: user.name ?? null
        });
        token.sub = record.id;
        token.name = record.name;
        token.email = record.email;
        token.picture = record.image;
        token.provider = "email";
        token.publicKey = null;
        token.walletType = null;
        return token;
      }

      if (user) {
        token.sub = user.id;
        token.name = user.name ?? token.name;
        token.email = (user.email as string | null) ?? token.email;
        token.picture = user.image ?? token.picture;
        token.provider = (user as any).provider ?? token.provider;
        token.publicKey = (user as any).publicKey ?? null;
        token.walletType = (user as any).walletType ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? session.user.id;
        session.user.name = token.name ?? session.user.name ?? undefined;
        session.user.email = (token.email as string | undefined) ?? undefined;
        session.user.image = token.picture as string | undefined;
        session.user.provider = (token.provider as string | undefined) ?? "google";
        session.user.publicKey = token.publicKey as string | undefined;
        session.user.walletType = token.walletType as WalletProvider | undefined;
      }
      return session;
    }
  },
  events: {
    async signIn(message) {
      if (message.account?.provider === "email" && message.user?.email) {
        console.info("[auth] Email sign-in", maskEmail(message.user.email));
      }
      if (message.account?.provider === "google" && message.user?.email) {
        console.info("[auth] Google sign-in", maskEmail(message.user.email));
      }
      if (message.account?.provider === "solana" && (message.user as any)?.publicKey) {
        console.info("[auth] Solana SiWS", maskPublicKey((message.user as any).publicKey));
      }
    }
  }
};

export const { handlers, auth } = NextAuth(authConfig);

export type { WalletProvider } from "@/lib/auth/store";
