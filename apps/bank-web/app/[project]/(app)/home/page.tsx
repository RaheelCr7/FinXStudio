"use client";
import { CorporateHome } from "@/components/corporate/Home";
import { MeezanHome } from "@/components/MeezanHome";
import { OnlyFor } from "@/components/Frame";
import { useApp } from "@/components/AppProvider";

export default function HomePage() {
  const { project } = useApp();
  return project.shell === "corporate" ? <CorporateHome /> : <OnlyFor shell="meezan"><MeezanHome /></OnlyFor>;
}
