import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource-variable/inter";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "FinX Studio", description: "Build and publish banking journeys" };

/** Applies a saved theme before first paint so there is no flash of the wrong one. */
const THEME_INIT = `try{var t=localStorage.getItem("finx.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
