"use client";

import { useState } from "react";
import type { ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

const FALLBACK_SRC = "/markets/placeholder.svg";

export default function MarketCoverImage({
  src,
  alt = "",
  loading = "lazy",
  onError,
  ...imgProps
}: Props) {
  const [currentSrc, setCurrentSrc] = useState(src);

  return (
    <img
      {...imgProps}
      src={currentSrc}
      alt={alt}
      loading={loading}
      onError={(event) => {
        onError?.(event);
        if (currentSrc === FALLBACK_SRC) return;
        setCurrentSrc(FALLBACK_SRC);
      }}
    />
  );
}
