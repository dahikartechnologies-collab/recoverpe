import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      white: "#FFFFFF",
      black: "#0A0A0A",
      recoverpe: {
        white: "#FFFFFF",
        black: "#0A0A0A",
        canvas: "#FAFAFA",
        "grey-light": "#F3F4F6",
        "grey-medium": "#4B5563",
        muted: "#6B7280",
        subtle: "#9CA3AF",
        line: "#E5E7EB",
        "line-strong": "#D1D5DB",
        fill: "#F3F4F6",
        success: "#10B981",
        "success-ink": "#047857",
        "success-fill": "#ECFDF5",
        "success-line": "#A7F3D0",
        error: "#EF4444",
        "danger-ink": "#B91C1C",
        "danger-fill": "#FEF2F2",
        "danger-line": "#FECACA",
        "warning-ink": "#B45309",
        "warning-fill": "#FFFBEB",
        "warning-line": "#FDE68A",
      },
      slate: {
        50: "#FAFAFA",
        100: "#F3F4F6",
        200: "#E5E7EB",
        500: "#6B7280",
        700: "#374151",
        800: "#1F2937",
      },
      emerald: {
        50: "#ECFDF5",
        200: "#A7F3D0",
        500: "#10B981",
        700: "#047857",
        950: "#022C22",
      },
      amber: {
        50: "#FFFBEB",
        200: "#FDE68A",
        500: "#F59E0B",
        700: "#B45309",
      },
      red: {
        50: "#FEF2F2",
        200: "#FECACA",
        500: "#EF4444",
        600: "#DC2626",
        700: "#B91C1C",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
      },
      transitionDuration: {
        150: "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
