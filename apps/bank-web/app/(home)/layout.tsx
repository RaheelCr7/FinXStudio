import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "../globals.css";

export const metadata: Metadata = { title: "FinX web banking", description: "Sandbox web banking for the FinX bank apps" };

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-brand="meezan"><head><link rel="stylesheet" href="/api/theme/meezan" /></head><body>{children}</body></html>;
}
