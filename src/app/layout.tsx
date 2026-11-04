import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PageMotion from "@/components/ui/PageMotion";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Heloraa Clinic | Connected Healthcare",
  description: "Secure, connected healthcare for patients and care teams.",
  applicationName: "Heloraa Clinic",
  manifest: "/manifest.webmanifest",

  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },

  appleWebApp: {
    capable: true,
    title: "Heloraa",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#123B5D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <PageMotion />
        {children}
      </body>
    </html>
  );
}
