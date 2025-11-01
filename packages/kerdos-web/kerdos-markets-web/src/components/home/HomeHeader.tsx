"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import ThemeToggle from "@/components/ui/ThemeToggle";
import styles from "@/styles/components/HomeHeader.module.css";

export default function HomeHeader() {
  const router = useRouter();

  const handleLogin = useCallback(() => {
    router.push("/login");
  }, [router]);

  const handleSignup = useCallback(() => {
    router.push("/signup");
  }, [router]);

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src="/markets/logo.svg?v=4" alt="Kerdos Markets" className={styles.logo} />
        <span className={styles.title}>Kérdos Markets</span>
      </div>
      <div className={styles.actions}>
        <ThemeToggle />
        <div className={styles.authButtons}>
          <button
            type="button"
            className={`${styles.authButton} ${styles.authButtonOutline}`}
            onClick={handleLogin}
          >
            Log in
          </button>
          <button
            type="button"
            className={`${styles.authButton} ${styles.authButtonFilled}`}
            onClick={handleSignup}
          >
            Sign up
          </button>
        </div>
      </div>
    </header>
  );
}
