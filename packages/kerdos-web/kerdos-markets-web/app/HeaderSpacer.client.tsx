'use client';

import { usePathname } from "next/navigation";

export default function HeaderSpacer() {
  const pathname = usePathname();
  const isDetail = pathname?.startsWith("/markets/");

  if (isDetail) return null;
  return <div id="app-header-spacer" style={{ height: "var(--header-height, 65px)" }} />;
}
