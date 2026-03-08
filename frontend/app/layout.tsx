import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700", "800"],
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CF Feedback Aggregator",
  description:
    "Real-time product feedback intelligence from 9 sources across the Cloudflare ecosystem",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${mono.variable} ${display.variable} noise min-h-screen`}>
        {/* Top accent line */}
        <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent z-50" />

        <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-6">
            <div className="flex items-center justify-between h-14">
              <a href="/" className="flex items-center gap-3 group">
                <div className="relative">
                  <div className="w-8 h-8 bg-accent rounded flex items-center justify-center font-bold text-[11px] text-black tracking-tight">
                    CF
                  </div>
                  <div className="absolute inset-0 bg-accent rounded opacity-0 group-hover:opacity-40 blur-lg transition-opacity duration-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold tracking-tight font-[family-name:var(--font-display)]">
                    Feedback Aggregator
                  </span>
                  <span className="text-[10px] text-muted tracking-widest uppercase">
                    Intelligence Platform
                  </span>
                </div>
              </a>
              <div className="flex items-center gap-1">
                <NavLink href="/">Dashboard</NavLink>
                <NavLink href="/feed">Feed</NavLink>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-[1400px] mx-auto px-6 py-8">{children}</main>

        {/* Bottom status bar */}
        <footer className="fixed bottom-0 left-0 right-0 h-7 bg-surface border-t border-border flex items-center px-6 text-[10px] text-muted tracking-wider uppercase z-40">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
            <span>System Online</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span>Workers + D1 + KV + Queues + AI</span>
            <span className="text-accent">v1.0</span>
          </div>
        </footer>

        <div className="h-8" />
      </body>
    </html>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="px-3 py-1.5 text-[12px] text-muted hover:text-foreground tracking-wider uppercase transition-colors duration-200 hover:bg-surface rounded"
    >
      {children}
    </a>
  );
}
