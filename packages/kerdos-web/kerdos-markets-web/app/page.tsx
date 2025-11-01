"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import HeroCarousel from "@/components/home/HeroCarousel";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getMarkets } from "@/lib/markets";
import headerStyles from "@/styles/components/HomeHeader.module.css";
import styles from "./page.module.css";

const marketsData = getMarkets();

export default function Page() {
  const router = useRouter();
  const markets = useMemo(() => marketsData, []);

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
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.layout}>
          <HeroCarousel markets={markets} brand={brand} actions={actions} variant="content" />
        </div>
      </div>
    </main>
  );
}
