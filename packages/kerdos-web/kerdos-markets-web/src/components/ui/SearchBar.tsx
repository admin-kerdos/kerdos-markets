"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import styles from "@/styles/components/SearchBar.module.css";

type SearchBarProps = InputHTMLAttributes<HTMLInputElement> & {
  /**
   * Optional additional class for the input element when further customization is needed.
   */
  inputClassName?: string;
};

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { className, inputClassName, placeholder = "Buscar mercados...", type = "search", "aria-label": ariaLabel, ...inputProps },
  ref
) {
  return (
    <label className={cn(styles.searchBar, className)}>
      <span className={styles.visuallyHidden}>Buscar mercados</span>
      <span className={styles.icon} aria-hidden="true">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M11 4a7 7 0 0 1 5.6 11.2l3.5 3.5a1 1 0 0 1-1.4 1.4l-3.5-3.5A7 7 0 1 1 11 4zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <input
        {...inputProps}
        ref={ref}
        type={type}
        aria-label={ariaLabel ?? "Buscar mercados"}
        placeholder={placeholder}
        className={cn(styles.input, inputClassName)}
        autoComplete={inputProps.autoComplete ?? "off"}
      />
    </label>
  );
});

export default SearchBar;
