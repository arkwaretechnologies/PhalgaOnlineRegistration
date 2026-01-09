import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhALGA Online Registration",
  description: "18th Mindanao Geographic Conference Registration",
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

