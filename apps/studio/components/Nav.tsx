"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const path = usePathname();
  const items = [
    { href: "/", label: "Journeys", on: path === "/" || path.startsWith("/journeys") },
    { href: "/agents", label: "Agents", on: path.startsWith("/agents") },
  ];
  return (
    <nav className="tabs" aria-label="Sections">
      {items.map((i) => <Link key={i.href} href={i.href} className={`tab ${i.on ? "on" : ""}`} aria-current={i.on ? "page" : undefined}>{i.label}</Link>)}
    </nav>
  );
}
