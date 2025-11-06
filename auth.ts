import { NextAuth } from "@auth/nextjs";
import Google from "@auth/core/providers/google";
import Credentials from "@auth/core/providers/credentials";
import type { NextAuthConfig } from "@auth/nextjs";

import { getChallenge, markChallengeUsed } from "@/lib/auth/challenges";
import { verifySignature } from "@/lib/auth/solana";
import {
  maskEmail,
  maskPublicKey,
  upsertGoogleUser,
  upsertWalletUser,
  type WalletProvider
} from "@/lib/auth/store";
import { serverEnv } from "@/lib/env/server";

export const authConfig: NextAuthConfig = {
  secret: serverEnv.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
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
  ],
  callbacks: {
    async jwt({ token, user }) {
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
