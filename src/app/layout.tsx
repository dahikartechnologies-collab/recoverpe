import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recoverpe",
  description:
    "Automated accounts receivable and personal lending reminders via WhatsApp and AI voice calling.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-recoverpe-white font-sans text-recoverpe-black antialiased">
        {children}
      </body>
    </html>
  );
}
