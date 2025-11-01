"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import Switch from "@/components/ui/Switch";
import styles from "@/styles/components/ThemeToggle.module.css";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function handleChange(nextIsLight: boolean) {
    setTheme(nextIsLight ? "light" : "dark");
  }

  return (
    <div className={styles.wrapper}>
      <Switch
        id="theme-switch"
        checked={theme === "light"}
        onCheckedChange={handleChange}
        aria-label="Cambiar tema"
      />
    </div>
  );
}
