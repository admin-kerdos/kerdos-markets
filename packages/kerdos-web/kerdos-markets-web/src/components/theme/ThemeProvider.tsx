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

import { themes } from "@/theme/vars";
import type { ThemeName } from "@/theme/tokens";

const STORAGE_KEY = "kerdos-theme";

type Theme = ThemeName;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (value: Theme) => void;
  toggle: () => void;
};

const ThemeCtx = createContext<ThemeContextValue>({ theme: "light", setTheme: () => {}, toggle: () => {} });

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const vars = themes[theme];
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.style.backgroundColor = vars["--color-bg"];
  root.style.color = vars["--color-text"];
  root.style.setProperty("color-scheme", theme);
  if (document.body) {
    document.body.style.backgroundColor = vars["--color-bg"];
    document.body.style.color = vars["--color-text"];
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial = stored === "light" || stored === "dark" ? (stored as Theme) : "light";
    applyTheme(initial);
    setThemeState(initial);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        const next = event.newValue === "light" || event.newValue === "dark" ? (event.newValue as Theme) : "light";
        applyTheme(next);
        setThemeState(next);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
