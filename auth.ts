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

const EMAIL_RATE_LIMIT_INTERVAL_MS = 30_000;
const EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_RATE_LIMIT_MAX_REQUESTS = 5;
const EMAIL_SUBJECT = "Tu enlace de acceso a Kérdos";

type RateLimiterEntry = {
  timestamps: number[];
  lastSent: number;
};

const emailRateLimiter = new Map<string, RateLimiterEntry>();
const emailProviderEnabled = serverEnv.EMAIL_SIGNIN_ENABLED;

class EmailRateLimitError extends Error {
  status = 429;
  cooldown?: number;
  constructor(message: string, cooldown?: number) {
    super(message);
    this.name = "EmailRateLimitError";
    this.cooldown = cooldown;
  }
}

const disableEmailDelivery = serverEnv.EMAIL_DISABLE_DELIVERY;

const getClientIp = (request?: Request): string => {
  if (!request) return "unknown";
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const candidate = forwarded.split(",")[0]?.trim();
    if (candidate) return candidate;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  const anyRequest = request as unknown as { ip?: string };
  if (typeof anyRequest?.ip === "string" && anyRequest.ip.length > 0) {
    return anyRequest.ip;
  }
  return "unknown";
};

const prepareRateLimit = (identifier: string, request?: Request) => {
  const normalizedEmail = identifier.trim().toLowerCase();
  const ip = getClientIp(request);
  const key = `${normalizedEmail}::${ip}`;
  const now = Date.now();
  const entry = emailRateLimiter.get(key) ?? { timestamps: [], lastSent: 0 };

  entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < EMAIL_RATE_LIMIT_WINDOW_MS);

  if (entry.lastSent > 0) {
    const sinceLast = now - entry.lastSent;
    if (sinceLast < EMAIL_RATE_LIMIT_INTERVAL_MS) {
      const cooldown = Math.ceil((EMAIL_RATE_LIMIT_INTERVAL_MS - sinceLast) / 1000);
      throw new EmailRateLimitError("Demasiadas solicitudes. Intenta de nuevo en 30 segundos.", cooldown);
    }
  }

  if (entry.timestamps.length >= EMAIL_RATE_LIMIT_MAX_REQUESTS) {
    throw new EmailRateLimitError("Alcanzaste el límite de solicitudes por hora. Inténtalo más tarde.");
  }

  return { key, entry, now };
};

const buildEmailHtml = (magicLink: string): string => `<!DOCTYPE html>
<html lang="es">
  <body style="font-family: Arial, sans-serif; background-color:#0b1120; color:#e2e8f0; padding:24px;">
    <h1 style="margin-top:0; font-size:20px;">Tu enlace de acceso a Kérdos</h1>
    <p style="font-size:15px; line-height:1.5;">Hola,</p>
    <p style="font-size:15px; line-height:1.5;">Haz clic en el botón para iniciar sesión de forma segura.</p>
    <p>
      <a href="${magicLink}" style="display:inline-block; padding:12px 20px; background:#d97706; color:#fff7ed; text-decoration:none; border-radius:999px; font-weight:600;">Iniciar sesión</a>
    </p>
    <p style="font-size:13px; line-height:1.5;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
    <p style="font-size:13px; word-break:break-all;">${magicLink}</p>
    <p style="font-size:12px; color:#94a3b8;">Si no solicitaste este correo, puedes ignorarlo.</p>
  </body>
</html>`;

const buildEmailText = (magicLink: string): string =>
  `Hola,

Usa el siguiente enlace para iniciar sesión en Kérdos:
${magicLink}

Si no solicitaste este correo, puedes ignorarlo.`;

const sendVerificationEmail = async (
  identifier: string,
  url: string,
  provider: { from?: string; server?: string },
  entry: RateLimiterEntry,
  key: string,
  now: number
) => {
  if (disableEmailDelivery) {
    console.info("[auth] Email magic link (delivery disabled)", maskEmail(identifier));
    entry.timestamps.push(now);
    entry.lastSent = now;
    emailRateLimiter.set(key, entry);
    return;
  }

  const fromAddress = provider.from ?? serverEnv.EMAIL_FROM ?? "Kérdos <no-reply@kerdos.xyz>";
  const htmlBody = buildEmailHtml(url);
  const textBody = buildEmailText(url);

  if (provider.server ?? serverEnv.EMAIL_SERVER) {
    try {
      const dynamicImport = new Function("modulePath", "return import(modulePath);") as (
        modulePath: string
      ) => Promise<{ createTransport: (...args: unknown[]) => any }>;
      const nodemailer = await dynamicImport("nodemailer");
      const transport = nodemailer.createTransport(provider.server ?? serverEnv.EMAIL_SERVER!);
      await transport.sendMail({
        to: identifier,
        from: fromAddress,
        subject: EMAIL_SUBJECT,
        text: textBody,
        html: htmlBody
      });
    } catch (error) {
      throw new Error(
        "La entrega SMTP requiere la dependencia 'nodemailer'. Instálala con `npm install nodemailer` (usa --legacy-peer-deps si es necesario) o establece EMAIL_DISABLE_DELIVERY=true para desactivar el envío en este entorno."
      );
    }
  } else if (serverEnv.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress,
        to: identifier,
        subject: EMAIL_SUBJECT,
        html: htmlBody,
        text: textBody
      })
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`No se pudo enviar el correo (${response.status}). ${details}`);
    }
  } else {
    console.warn("[auth] No email transport configured. Magic link not sent.");
  }

  entry.timestamps.push(now);
  entry.lastSent = now;
  emailRateLimiter.set(key, entry);
  console.info("[auth] Email magic link", maskEmail(identifier));
};

const providers: NextAuthConfig["providers"] = [];

if (serverEnv.GOOGLE_SIGNIN_ENABLED && serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET) {
  providers.push(
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
    })
  );
} else {
  console.warn("[auth] Google provider disabled (missing credentials or flag)");
}

providers.push(
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
);

if (emailProviderEnabled) {
  const emailFrom = serverEnv.EMAIL_FROM ?? "Kérdos <no-reply@kerdos.xyz>";
  const emailProvider = Email({
    from: emailFrom,
    maxAge: 15 * 60,
    async sendVerificationRequest({ identifier, url, provider, request }) {
      const { key, entry, now } = prepareRateLimit(identifier, request);
      try {
        await sendVerificationEmail(identifier, url, provider, entry, key, now);
      } catch (error) {
        if (error instanceof EmailRateLimitError) {
          throw new Response(
            JSON.stringify({ message: error.message, cooldown: error.cooldown ?? 30 }),
            {
              status: error.status,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        if (error instanceof Response) {
          throw error;
        }

        const message = error instanceof Error ? error.message : "No se pudo enviar el enlace de acceso.";
        throw new Response(JSON.stringify({ message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  });

  if (serverEnv.EMAIL_SERVER) {
    emailProvider.server = serverEnv.EMAIL_SERVER;
  }

  providers.push(emailProvider);
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
    },
    async redirect({ url, baseUrl }) {
      try {
        const absoluteUrl = url.startsWith("http") ? new URL(url) : new URL(url, baseUrl);
        if (absoluteUrl.searchParams.get("error") === "Verification") {
          return `${baseUrl}/?authModal=login&authError=email-expired`;
        }
        if (absoluteUrl.origin !== baseUrl) {
          return baseUrl;
        }
        return absoluteUrl.toString();
      } catch {
        return baseUrl;
      }
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
    },
    async error(error) {
      if (error?.name === "EmailRateLimitError") {
        console.warn("[auth] Email rate limit", error.message);
      }
    }
  }
};

export const { handlers, auth } = NextAuth(authConfig);

export type { WalletProvider } from "@/lib/auth/store";
