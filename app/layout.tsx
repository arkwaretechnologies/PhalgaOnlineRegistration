import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PHALGA Online Registration",
  description: "17th Mindanao Geographic Conference Registration",
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

