import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export const metadata: Metadata = {
  title: "Recoverpe",
  description:
    "Automated accounts receivable and personal lending reminders via WhatsApp and AI voice calling.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Recoverpe",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/favicon-32x32.png",
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-9X4LWG7Q94"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-9X4LWG7Q94', {
              page_path: window.location.pathname,
            });
          `}
        </Script>
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegister />
        <Suspense fallback={null}>
          <MetaPixel />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
