"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import headerStyles from "@/styles/components/HomeHeader.module.css";

type Props = {
  name: string;
  image?: string | null;
  onSignOut: () => Promise<void>;
};

export default function UserAccountMenu({ name, image, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const initial = useMemo(() => {
    if (!name || name.length === 0) return "U";
    return name.trim().charAt(0).toUpperCase();
  }, [name]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleProfile = useCallback(() => {
    setOpen(false);
    window.location.href = "/perfil";
  }, []);

  const handleSignOut = useCallback(async () => {
    setOpen(false);
    await onSignOut();
  }, [onSignOut]);

  return (
    <div className={headerStyles.userMenu} ref={containerRef}>
      <button
        type="button"
        className={headerStyles.avatarButton}
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {image ? (
          <img src={image} alt={name} className={headerStyles.avatarImage} />
        ) : (
          <span className={headerStyles.avatarInitial}>{initial}</span>
        )}
      </button>
      <div role="menu" className={open ? `${headerStyles.menu} ${headerStyles.menuOpen}` : headerStyles.menu}>
        <button type="button" role="menuitem" className={headerStyles.menuItem} onClick={handleProfile}>
          Perfil
        </button>
        <div className={headerStyles.menuSeparator} aria-hidden="true" />
        <button type="button" role="menuitem" className={headerStyles.menuItem} onClick={handleSignOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
