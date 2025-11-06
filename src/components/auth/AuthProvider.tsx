"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { Buffer } from "buffer";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import type { WalletProvider } from "@/lib/auth/store";
import AuthModal from "./AuthModal";

const normalizeFlag = (value: string | undefined): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const EMAIL_PROVIDER_ENABLED =
  normalizeFlag(process.env.NEXT_PUBLIC_EMAIL_PROVIDER_ENABLED) || normalizeFlag(process.env.EMAIL_PROVIDER_ENABLED);

const GOOGLE_PROVIDER_ID = "google";

type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  provider?: "google" | "wallet" | "email";
  publicKey?: string | null;
  walletType?: WalletProvider | null;
};

type AuthIntent = "login" | "signup";

type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated";
  user: SessionUser | null;
  modalOpen: boolean;
  intent: AuthIntent;
};

type EmailSignInResult = {
  ok: boolean;
  message?: string;
};

type AuthContextValue = {
  state: AuthState;
  modalError: string | null;
  walletError: string | null;
  openAuthModal: (intent?: AuthIntent) => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => void;
  signInWithEmail: (email: string) => Promise<EmailSignInResult>;
  signInWithWallet: (wallet: WalletProvider) => Promise<void>;
  signOut: () => Promise<void>;
  emailProviderEnabled: boolean;
};

type AutomationWalletStub = {
  publicKey?: string;
  signature?: string;
  nonce?: string;
  redirectTo?: string;
};

declare global {
  interface Window {
    __KERDOS_AUTOMATION__?: {
      wallet?: Partial<Record<WalletProvider, AutomationWalletStub>>;
    };
    __KERDOS_EMAIL_PROVIDER_ENABLED__?: boolean;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<SessionUser | null> {
  try {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (!data || !data.user) return null;
    return data.user as SessionUser;
  } catch {
    return null;
  }
}

type Props = {
  children: ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [modalOpen, setModalOpen] = useState(false);
  const [intent, setIntent] = useState<AuthIntent>("login");
  const [modalError, setModalError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [emailProviderEnabled, setEmailProviderEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined" && typeof window.__KERDOS_EMAIL_PROVIDER_ENABLED__ === "boolean") {
      return window.__KERDOS_EMAIL_PROVIDER_ENABLED__;
    }
    return EMAIL_PROVIDER_ENABLED;
  });

  const { wallets, select, connect, publicKey, disconnect, signMessage } = useWallet();

  const refreshSession = useCallback(async () => {
    setStatus("loading");
    const nextUser = await fetchSession();
    setUser(nextUser);
    setStatus(nextUser ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const override = window.__KERDOS_EMAIL_PROVIDER_ENABLED__;
    if (typeof override === "boolean") {
      setEmailProviderEnabled(override);
    }
  }, []);

  useEffect(() => {
    if (!walletError) return;
    const timeout = window.setTimeout(() => {
      setWalletError(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [walletError]);

  const openAuthModal = useCallback((nextIntent: AuthIntent = "login") => {
    setIntent(nextIntent);
    setModalError(null);
    setWalletError(null);
    setModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setModalOpen(false);
    setModalError(null);
    setWalletError(null);
  }, []);

  const signInWithGoogle = useCallback(() => {
    setModalError(null);
    setModalOpen(false);

    if (typeof window === "undefined") {
      console.error("Google sign-in requiere un entorno de navegador.");
      return;
    }

    const initiateGoogleSignIn = async () => {
      const { origin, pathname, search } = window.location;
      const callbackUrl = `${origin}${pathname}${search}`;

      try {
        const csrfResponse = await fetch("/api/auth/csrf", {
          method: "GET",
          credentials: "include"
        });

        if (!csrfResponse.ok) {
          throw new Error("No se pudo obtener el token CSRF.");
        }

        const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string };
        if (!csrfToken) {
          throw new Error("Token CSRF inválido.");
        }

        const form = document.createElement("form");
        form.method = "POST";
        form.action = `/api/auth/signin/${GOOGLE_PROVIDER_ID}`;
        form.style.display = "none";

        const csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "csrfToken";
        csrfInput.value = csrfToken;
        form.appendChild(csrfInput);

        const callbackInput = document.createElement("input");
        callbackInput.type = "hidden";
        callbackInput.name = "callbackUrl";
        callbackInput.value = callbackUrl;
        form.appendChild(callbackInput);

        document.body.appendChild(form);
        form.submit();
      } catch (error) {
        console.error("Error iniciando sesión con Google", error);
        setModalError("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
        setModalOpen(true);
      }
    };

    void initiateGoogleSignIn();
  }, [setModalError, setModalOpen]);

  const signInWithEmail = useCallback(
    async (rawEmail: string): Promise<EmailSignInResult> => {
      if (typeof window === "undefined") {
        console.error("El inicio de sesión con correo requiere un entorno de navegador.");
        return { ok: false, message: "Esta acción solo está disponible en un navegador compatible." };
      }

      const email = rawEmail.trim();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        return { ok: false, message: "Ingresa un correo electrónico válido." };
      }

      if (!emailProviderEnabled) {
        console.info("Email sign-in provider not configured; showing stub response.");
        return { ok: false, message: "Aún no habilitamos el acceso con correo en esta versión." };
      }

      try {
        setModalError(null);

        const { origin, pathname, search } = window.location;
        const callbackUrl = `${origin}${pathname}${search}`;

        const csrfResponse = await fetch("/api/auth/csrf", {
          method: "GET",
          credentials: "include"
        });

        if (!csrfResponse.ok) {
          throw new Error("No se pudo obtener el token CSRF.");
        }

        const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string };
        if (!csrfToken) {
          throw new Error("Token CSRF inválido.");
        }

        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/auth/signin/email";
        form.style.display = "none";

        const csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "csrfToken";
        csrfInput.value = csrfToken;
        form.appendChild(csrfInput);

        const emailInput = document.createElement("input");
        emailInput.type = "hidden";
        emailInput.name = "email";
        emailInput.value = email;
        form.appendChild(emailInput);

        const callbackInput = document.createElement("input");
        callbackInput.type = "hidden";
        callbackInput.name = "callbackUrl";
        callbackInput.value = callbackUrl;
        form.appendChild(callbackInput);

        document.body.appendChild(form);
        form.submit();
        setTimeout(() => {
          form.remove();
        }, 2000);

        setModalOpen(false);
        return { ok: true };
      } catch (error) {
        console.error("Error iniciando sesión con correo", error);
        return { ok: false, message: "No se pudo enviar el enlace de acceso. Inténtalo de nuevo." };
      }
    },
    [emailProviderEnabled, setModalOpen]
  );

  const ensureWalletReady = useCallback(
    async (walletType: WalletProvider): Promise<string> => {
      const targetName = walletType === "phantom" ? "Phantom" : "Solflare";
      const entry = wallets.find((wallet) => wallet.adapter.name.toLowerCase() === targetName.toLowerCase());
      if (!entry) {
        throw new Error("Wallet no disponible en este dispositivo.");
      }
      if (entry.readyState === WalletReadyState.Unsupported) {
        throw new Error("Wallet no soportada en este navegador.");
      }
      if (entry.readyState === WalletReadyState.NotDetected) {
        throw new Error("Wallet no detectada. Instálala e inténtalo de nuevo.");
      }

      if (!entry.adapter.connected || !entry.adapter.publicKey) {
        await select(entry.adapter.name);
        await connect();
      }

      const resolved = entry.adapter.publicKey?.toBase58() ?? publicKey?.toBase58();
      if (!resolved) {
        throw new Error("No se pudo obtener la dirección pública de la wallet.");
      }
      return resolved;
    },
    [connect, publicKey, select, wallets]
  );

  const signInWithWallet = useCallback(
    async (walletType: WalletProvider) => {
      const automationStub =
        typeof window !== "undefined" ? window.__KERDOS_AUTOMATION__?.wallet?.[walletType] : undefined;

      if (automationStub) {
        try {
          setModalError(null);
          setWalletError(null);
          const redirectTo = automationStub.redirectTo ?? (typeof window !== "undefined" ? window.location.pathname : "/");
          await fetch("/api/siws/verify", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              publicKey: automationStub.publicKey ?? `automation-${walletType}`,
              signature: automationStub.signature ?? "automation-signature",
              nonce: automationStub.nonce ?? `automation-nonce-${walletType}`,
              walletType,
              redirectTo
            })
          });
          await refreshSession();
          setModalOpen(false);
          return;
        } catch (error) {
          console.error("Error en modo automatizado de wallet", error);
          setWalletError("No se pudo verificar la firma.");
          return;
        }
      }

      try {
        setModalError(null);
        setWalletError(null);
        const resolvedPublicKey = await ensureWalletReady(walletType);

        if (!signMessage) {
          throw new Error("La wallet seleccionada no permite firmar mensajes.");
        }

        const challengeResponse = await fetch("/api/siws/challenge", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: resolvedPublicKey, walletType })
        });

        if (!challengeResponse.ok) {
          throw new Error("No se pudo obtener el reto de firma.");
        }

        const { challenge, nonce } = (await challengeResponse.json()) as { challenge: string; nonce: string };
        if (!challenge || !nonce) {
          throw new Error("Respuesta inválida del servidor.");
        }

        const messageBytes = new TextEncoder().encode(challenge);
        const signatureBytes = await signMessage(messageBytes);
        const signature = Buffer.from(signatureBytes).toString("base64");

        const verifyResponse = await fetch("/api/siws/verify", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: resolvedPublicKey,
            signature,
            nonce,
            walletType,
            redirectTo: window.location.pathname
          })
        });

        if (!verifyResponse.ok) {
          const errorPayload = await verifyResponse.json().catch(() => ({}));
          throw new Error(errorPayload?.error ?? "No se pudo verificar la firma.");
        }

        await refreshSession();
        setModalOpen(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ocurrió un error inesperado al iniciar sesión.";
        setWalletError(message);
        await disconnect().catch(() => {});
      }
    },
    [connect, disconnect, ensureWalletReady, publicKey, refreshSession, signMessage]
  );

  const signOut = useCallback(async () => {
    try {
      const callbackUrl = encodeURIComponent(window.location.pathname);
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ callbackUrl }).toString()
      });
      if (response.redirected) {
        window.location.href = response.url;
        return;
      }
      await refreshSession();
    } catch (error) {
      console.error("No se pudo cerrar la sesión", error);
    }
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state: {
        status,
        user,
        modalOpen,
        intent
      },
      modalError,
      walletError,
      openAuthModal,
      closeAuthModal,
      signInWithGoogle,
      signInWithEmail,
      signInWithWallet,
      signOut,
      emailProviderEnabled
    }),
    [status, user, modalOpen, intent, modalError, walletError, openAuthModal, closeAuthModal, signInWithGoogle, signInWithEmail, signInWithWallet, signOut, emailProviderEnabled]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
