import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { abcRepro, abcReproMono } from "./fonts";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FaceTime Vera",
  description: "Created by The Founder Series",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${abcReproMono.variable} ${abcRepro.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
