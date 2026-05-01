import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TVChat — Short video by TV channel",
  description: "Pick a channel, post clips, comment, like, and share.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased font-sans`}
      >
        <header className="border-b border-white/10 bg-black/40 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3 text-sm">
            <Link href="/" className="font-semibold text-[var(--foreground)]">
              TVChat
            </Link>
            <Link
              href="/feed"
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Feed
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
