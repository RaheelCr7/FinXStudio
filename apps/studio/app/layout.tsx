import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = { title: "FinX Studio", description: "Build and publish banking journeys" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="logo"><i>F</i>FinX Studio</Link>
          <Nav />
          <div className="spacer" />
          <span className="chip warn">UAT</span>
          <span className="chip">Meezan Digital</span>
        </header>
        {children}
      </body>
    </html>
  );
}
