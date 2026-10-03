import { InvoiceLayoutTheme } from "@/lib/invoice-line-items";

export interface InvoiceThemeTokens {
  headerBg: string;
  headerFg: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
  tableHeaderBg: string;
  rowAlt: string;
  pageBg: string;
  radius: number;
  tableBorderWidth: number;
}

const THEMES: Record<InvoiceLayoutTheme, InvoiceThemeTokens> = {
  minimalist: {
    headerBg: "#0A0A0A",
    headerFg: "#FFFFFF",
    accent: "#0A0A0A",
    text: "#0A0A0A",
    muted: "#525252",
    border: "#0A0A0A",
    tableHeaderBg: "#F5F5F5",
    rowAlt: "#FFFFFF",
    pageBg: "#FFFFFF",
    radius: 0,
    tableBorderWidth: 1.5,
  },
  corporate: {
    headerBg: "#0A192F",
    headerFg: "#FFFFFF",
    accent: "#00695C",
    text: "#0A192F",
    muted: "#475569",
    border: "#CBD5E1",
    tableHeaderBg: "#0A192F",
    rowAlt: "#F8FAFC",
    pageBg: "#FFFFFF",
    radius: 0,
    tableBorderWidth: 1,
  },
  modern: {
    headerBg: "#F8FAFC",
    headerFg: "#0A0A0A",
    accent: "#10B981",
    text: "#0A0A0A",
    muted: "#6B7280",
    border: "transparent",
    tableHeaderBg: "#F3F4F6",
    rowAlt: "#F3F4F6",
    pageBg: "#FFFFFF",
    radius: 12,
    tableBorderWidth: 0,
  },
};

export function invoiceThemeTokens(theme: InvoiceLayoutTheme): InvoiceThemeTokens {
  return THEMES[theme];
}

export function invoiceThemeCssVars(theme: InvoiceLayoutTheme): Record<string, string> {
  const tokens = invoiceThemeTokens(theme);

  return {
    "--inv-header-bg": tokens.headerBg,
    "--inv-header-fg": tokens.headerFg,
    "--inv-accent": tokens.accent,
    "--inv-text": tokens.text,
    "--inv-muted": tokens.muted,
    "--inv-border": tokens.border,
    "--inv-table-header": tokens.tableHeaderBg,
    "--inv-row-alt": tokens.rowAlt,
    "--inv-page-bg": tokens.pageBg,
    "--inv-radius": `${tokens.radius}px`,
  };
}
