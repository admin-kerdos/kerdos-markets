"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import HeroCarousel from "@/components/home/HeroCarousel";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { UiMarket } from "@/lib/markets";
import headerStyles from "@/styles/components/HomeHeader.module.css";
import styles from "./AppHeader.module.css";

type Props = {
  markets: UiMarket[];
};

export default function AppHeader({ markets }: Props) {
  const router = useRouter();

  const handleLogin = useCallback(() => {
    router.push("/login");
  }, [router]);

  const handleSignup = useCallback(() => {
    router.push("/signup");
  }, [router]);

  const brand = (
    <div className={headerStyles.brand}>
      <img src="/markets/logo.svg?v=4" alt="Kerdos Markets" className={headerStyles.logo} />
      <span className={headerStyles.title}>Kérdos Markets</span>
    </div>
  );

  const actions = (
    <div className={headerStyles.actions}>
      <ThemeToggle />
      <div className={headerStyles.authButtons}>
        <button
          type="button"
          className={`${headerStyles.authButton} ${headerStyles.authButtonOutline}`}
          onClick={handleLogin}
        >
          Log in
        </button>
        <button
          type="button"
          className={`${headerStyles.authButton} ${headerStyles.authButtonFilled}`}
          onClick={handleSignup}
        >
          Sign up
        </button>
      </div>
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
