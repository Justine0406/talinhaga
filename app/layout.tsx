import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Fraunces drives makata-mode output and the wordmark — we need italic + a couple of weights.
// Inter is the UI/body font and Hugot/Salawikain output. Both expose CSS variables that
// app/globals.css consumes via --font-serif / --font-sans theme tokens.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Talinhaga — Gawing malalim ang anumang sabihin mo",
  description:
    "Pasahin ang anumang sentence at gawing makata, hugot, o salawikain. Filipino AI tool by @justineph.",
  openGraph: {
    title: "Talinhaga",
    description: "Gawing malalim ang anumang sabihin mo.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Talinhaga",
    description: "Gawing malalim ang anumang sabihin mo.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Sonner toaster lives in the root layout so toasts survive any future
            navigation and stay decoupled from page-level state. */}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
