"use client";
import { OnlyFor } from "@/components/Frame";
import { Dashboard } from "@/components/bankworkx/Dashboard";

export default function DashboardPage() {
  return <OnlyFor shell="bankworkx"><Dashboard /></OnlyFor>;
}
