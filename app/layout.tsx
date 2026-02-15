import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import Footer from "@/components/Footer";
import MaintenanceGuard from "@/components/MaintenanceGuard";

export const metadata: Metadata = {
  title: "PhALGA Online Registration System",
  description: "PhALGA Online Registration System",
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <Suspense fallback={null}>
          <MaintenanceGuard />
        </Suspense>
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

