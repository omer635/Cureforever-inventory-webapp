import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import RegisterSW from "@/components/RegisterSW";
import InstallPWAButton from "@/components/InstallPWAButton";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>
        {children}
        <RegisterSW />
        <InstallPWAButton />
      </body>
    </html>
  );
}