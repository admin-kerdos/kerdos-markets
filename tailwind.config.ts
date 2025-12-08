const config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        surfaceElevated: "var(--color-surface-elevated)",
        surfaceMuted: "var(--color-surface-muted)",
        border: "var(--color-border)",
        brand: {
          DEFAULT: "var(--color-brand)",
          strong: "var(--color-brand-strong)",
          contrast: "var(--color-brand-contrast)"
        },
        success: {
          DEFAULT: "var(--color-success)",
          strong: "var(--color-success-strong)",
          active: "var(--color-success-active)",
          contrast: "var(--color-success-contrast)"
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          strong: "var(--color-danger-strong)",
          active: "var(--color-danger-active)",
          contrast: "var(--color-danger-contrast)"
        },
        focus: "var(--color-focus)",
        text: {
          DEFAULT: "var(--color-text)",
          muted: "var(--color-text-muted)",
          subtle: "var(--color-text-subtle)"
        }
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)"
      }
    }
  },
  plugins: []
};

export default config;
