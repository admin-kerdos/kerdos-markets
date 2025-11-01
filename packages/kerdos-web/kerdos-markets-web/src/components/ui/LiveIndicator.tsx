import type { HTMLAttributes } from "react";
import styles from "@/styles/components/LiveIndicator.module.css";

type Props = HTMLAttributes<HTMLSpanElement>;

export default function LiveIndicator({ className, ...props }: Props) {
  const classNames = className ? `live-dot ${styles.root} ${className}` : `live-dot ${styles.root}`;
  return <span className={classNames} {...props} />;
}
