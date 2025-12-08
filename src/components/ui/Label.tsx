"use client";

import type { LabelHTMLAttributes } from "react";
import styles from "@/styles/components/Label.module.css";

type Props = LabelHTMLAttributes<HTMLLabelElement>;

export default function Label({ className, ...props }: Props) {
  const classes = className ? `${styles.label} ${className}` : styles.label;
  return <label className={classes} {...props} />;
}
