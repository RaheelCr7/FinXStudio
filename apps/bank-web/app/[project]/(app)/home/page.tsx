"use client";
import { MeezanHome } from "@/components/MeezanHome";
import { OnlyFor } from "@/components/Frame";

export default function HomePage() {
  return <OnlyFor shell="meezan"><MeezanHome /></OnlyFor>;
}
