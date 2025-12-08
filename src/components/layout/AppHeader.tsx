"use client";

import Link from "next/link";
import { useCallback } from "react";

import HeroCarousel from "@/components/home/HeroCarousel";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { UiMarket } from "@/lib/markets";
import headerStyles from "@/styles/components/HomeHeader.module.css";
import styles from "./AppHeader.module.css";
import { useAuth } from "@/components/auth/AuthProvider";
import UserAccountMenu from "@/components/auth/UserAccountMenu";

type Props = {
  markets: UiMarket[];
};

export default function AppHeader({ markets }: Props) {
  const { state, openAuthModal, signOut } = useAuth();

  const handleLogin = useCallback(() => {
    openAuthModal("login");
  }, [openAuthModal]);

  const handleSignup = useCallback(() => {
    openAuthModal("signup");
  }, [openAuthModal]);

  const brand = (
    <Link href="/" className={headerStyles.brand} aria-label="Ir a la página principal">
      <img src="/markets/logo.svg?v=4" alt="Kerdos Markets" className={headerStyles.logo} />
      <span className={headerStyles.title}>Kérdos Markets</span>
    </Link>
  );

  const actions = (
    <div className={headerStyles.actions}>
      <ThemeToggle />
      {state.status === "authenticated" && state.user ? (
        <UserAccountMenu onSignOut={signOut} name={state.user.name ?? "Usuario"} image={state.user.image ?? undefined} />
      ) : (
        <div className={headerStyles.authButtons}>
          <button
            type="button"
            className={`${headerStyles.authButton} ${headerStyles.authButtonOutline}`}
            onClick={handleLogin}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`${headerStyles.authButton} ${headerStyles.authButtonFilled}`}
            onClick={handleSignup}
          >
            Registrarse
          </button>
        </div>
      )}
    </div>
  );

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <HeroCarousel
          markets={markets}
          brand={brand}
          actions={actions}
          variant="header"
          showDivider
        />
      </div>
    </header>
  );
}
