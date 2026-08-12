import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

const garamond = Cormorant_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CureForever — Enterprise Inventory Platform",
  description: "CureForever enterprise inventory portal for vendors and administrators",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CureForever",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1F3D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${garamond.variable} ${inter.variable}`}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}