"use client";

import { useCallback, useMemo } from "react";
import HeroCarousel from "@/components/home/HeroCarousel";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getMarkets } from "@/lib/markets";
import headerStyles from "@/styles/components/HomeHeader.module.css";
import styles from "./page.module.css";
import { useAuth } from "@/components/auth/AuthProvider";
import UserAccountMenu from "@/components/auth/UserAccountMenu";

const marketsData = getMarkets();

export default function Page() {
  const { state, openAuthModal, signOut } = useAuth();
  const markets = useMemo(() => marketsData, []);

  const handleLogin = useCallback(() => {
    openAuthModal("login");
  }, [openAuthModal]);

  const handleSignup = useCallback(() => {
    openAuthModal("signup");
  }, [openAuthModal]);

  const brand = (
    <div className={headerStyles.brand}>
      <img src="/markets/logo.svg?v=4" alt="Kerdos Markets" className={headerStyles.logo} />
      <span className={headerStyles.title}>Kérdos Markets</span>
    </div>
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
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.layout}>
          <HeroCarousel markets={markets} brand={brand} actions={actions} variant="content" />
        </div>
      </div>
    </main>
  );
}
