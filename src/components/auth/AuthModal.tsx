"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import styles from "@/styles/components/AuthModal.module.css";
import { useAuth } from "./AuthProvider";

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
    <path
      fill="#4285F4"
      d="M17.64 9.2046c0-.6396-.0576-1.251-.1644-1.836H9v3.4725h4.8435c-.209 1.125-.8436 2.0805-1.798 2.7225v2.262h2.907C16.9806 14.727 17.64 12.1926 17.64 9.2046z"
    />
    <path
      fill="#34A853"
      d="M9.0001 18c2.43 0 4.467-0.807 5.955-2.175l-2.907-2.262c-.8055.54-1.836.859-3.048.859-2.3475 0-4.3305-1.584-5.037-3.711H0.957031v2.331C2.43603 15.615 5.48103 18 9.00003 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.963 10.7115C3.783 10.172 3.681 9.594 3.681 9s.102-1.172.282-1.7115V4.9575H0.957C0.348 6.1695 0 7.548 0 9s.348 2.8305.957 4.0425l3.006-2.331z"
    />
    <path
      fill="#EA4335"
      d="M9.0001 3.579c1.3227 0 2.5107.4554 3.444 1.35l2.583-2.583C13.463 0.873 11.426 0 9.0001 0 5.4811 0 2.4361 2.385 0.957031 5.9575L3.96303 8.2885C4.66953 6.162 6.65253 4.579 9.00003 4.579z"
    />
  </svg>
);

type WalletOption = "phantom" | "solflare";

const walletIcons: Record<WalletOption, JSX.Element> = {
  phantom: (
    <svg width="18" height="18" viewBox="0 0 256 256" aria-hidden focusable="false">
      <path
        fill="#8A63D2"
        d="M128 16C69.4 16 18 67.4 18 126s51.4 110 110 110 110-51.4 110-110S186.6 16 128 16Zm44.9 146.6c-11.8 11.9-33.4 20.2-58.8 20.2-13.7 0-27.5-2.2-39.9-6.3-5.2-1.7-5.9-8.7-1.2-11.3 18.2-9.8 44.1-23.4 61.4-30.3 6-2.4 11.2 4.4 7.4 9.8-4.8 6.7-9.9 12.8-15.3 18.1 16.7 1.9 33.2-2.7 42.9-12.5 16.6-16.8 19.4-46.8 7-68.2-10.2-17.5-29.3-28.4-52-28.4-37.5 0-67.9 24.8-70 55.7C53.8 102 48 93.9 48 84c0-10.7 6.4-20.6 17.7-28.1C86.3 42 106.3 36 128 36c47.5 0 86 36.4 86 82 0 17.9-6.7 35.4-19.1 48.6Z"
      />
    </svg>
  ),
  solflare: (
    <svg width="18" height="18" viewBox="0 0 256 256" aria-hidden focusable="false">
      <path
        fill="#F97316"
        d="M128.3 24 33 128.5l95.3 103.5 94.4-104.5Zm.2 38.8 61.9 65.5-62.1 68.7-62-67.4Z"
      />
    </svg>
  )
};

export default function AuthModal() {
  const { state, closeAuthModal, signInWithGoogle, signInWithEmail, signInWithWallet, modalError, walletError } = useAuth();

  const [emailValue, setEmailValue] = useState("");
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [phantomImageError, setPhantomImageError] = useState(false);
  const [solflareImageError, setSolflareImageError] = useState(false);

  useEffect(() => {
    if (!state.modalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAuthModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAuthModal, state.modalOpen]);

  useEffect(() => {
    if (!state.modalOpen) {
      setEmailValue("");
      setIsEmailValid(false);
      setToastMessage(null);
      setIsEmailSubmitting(false);
    }
  }, [state.modalOpen]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  if (!state.modalOpen) return null;

  const title = state.intent === "signup" ? "Crea tu cuenta" : "Inicia sesión";
  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isEmailSubmitting) return;
    setIsEmailSubmitting(true);
    try {
      const result = await signInWithEmail(emailValue.trim());
      if (result.ok) {
        setEmailValue("");
        setIsEmailValid(false);
      } else if (result.message) {
        setToastMessage(result.message);
      }
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={closeAuthModal}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-heading"
        className={styles.modal}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.closeButton} onClick={closeAuthModal} aria-label="Cerrar modal">
          <X size={18} />
        </button>
        {toastMessage ? (
          <div className={styles.toast} role="status" aria-live="assertive" data-auth-toast>
            {toastMessage}
          </div>
        ) : null}
        <div className={styles.header}>
          <h2 id="auth-modal-heading" className={styles.title}>
            {title}
          </h2>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.providerButton}
            onClick={signInWithGoogle}
            data-auth-section="google"
          >
            <span className={styles.providerIcon}>{GOOGLE_ICON}</span>
            Continuar con Google
          </button>
          <div className={styles.divider} role="separator" aria-orientation="horizontal" data-auth-section="divider">
            <span className={styles.dividerLine} aria-hidden="true" />
            <span className={styles.dividerLabel} aria-hidden="true">
              o
            </span>
            <span className={styles.dividerLine} aria-hidden="true" />
          </div>
          <form className={styles.emailRow} onSubmit={handleEmailSubmit} noValidate data-auth-section="email">
            <label htmlFor="auth-email-input" className={styles.srOnly}>
              Correo electrónico
            </label>
            <input
              id="auth-email-input"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="correo@ejemplo.com"
              aria-label="Correo electrónico"
              value={emailValue}
              onChange={(event) => {
                setEmailValue(event.target.value);
                const nextValue = event.target.value.trim();
                const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                setIsEmailValid(pattern.test(nextValue));
              }}
              className={styles.emailInput}
            />
            <button
              type="submit"
              className={styles.emailButton}
              disabled={!isEmailValid || isEmailSubmitting}
              aria-label="Continuar con correo"
            >
              Continuar
            </button>
          </form>
          <div
            className={styles.walletRow}
            role="group"
            aria-label="Conectar con una wallet"
            data-auth-section="wallets"
          >
            <button
              type="button"
              className={styles.walletButton}
              onClick={() => signInWithWallet("phantom")}
              aria-label="Conectar con Phantom"
              title="Conectar con Phantom"
            >
              <span className={styles.walletIcon}>
                {phantomImageError ? (
                  walletIcons.phantom
                ) : (
                  <Image
                    src="/markets/phantom_logo.png"
                    alt=""
                    width={24}
                    height={24}
                    unoptimized
                    className={styles.walletImage}
                    onError={() => setPhantomImageError(true)}
                  />
                )}
              </span>
            </button>
            <button
              type="button"
              className={styles.walletButton}
              onClick={() => signInWithWallet("solflare")}
              aria-label="Conectar con Solflare"
              title="Conectar con Solflare"
            >
              <span className={styles.walletIcon}>
                {solflareImageError ? (
                  walletIcons.solflare
                ) : (
                  <Image
                    src="/markets/solflare_logo.png"
                    alt=""
                    width={24}
                    height={24}
                    unoptimized
                    className={styles.walletImage}
                    onError={() => setSolflareImageError(true)}
                  />
                )}
              </span>
            </button>
          </div>
          {walletError ? (
            <p className={styles.inlineFeedback} role="status">
              {walletError}
            </p>
          ) : null}
          <div className={styles.footerLinks} data-auth-section="footer">
            <Link href="/terminos" className={styles.footerLink}>
              Términos
            </Link>
            <span className={styles.footerSeparator} aria-hidden="true">
              ·
            </span>
            <Link href="/privacidad" className={styles.footerLink}>
              Privacidad
            </Link>
          </div>
        </div>
        {modalError ? (
          <p className={styles.globalFeedback} role="status">
            {modalError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
