"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "@/styles/components/Switch.module.css";

type Props = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type">;

const Switch = forwardRef<HTMLInputElement, Props>(function Switch(
  { checked, onCheckedChange, className, id, ...props },
  ref
) {
  const classes = className ? `${styles.root} ${className}` : styles.root;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onCheckedChange(event.target.checked);
  }

  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      role="switch"
      aria-checked={checked}
      className={classes}
      checked={checked}
      onChange={handleChange}
      {...props}
    />
  );
});

export default Switch;
