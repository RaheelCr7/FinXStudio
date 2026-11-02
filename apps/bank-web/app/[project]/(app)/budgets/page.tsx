"use client";
import { OnlyFor } from "@/components/Frame";
import { Budgets } from "@/components/bankworkx/Tabs";

export default function Page() {
  return <OnlyFor shell="bankworkx"><Budgets /></OnlyFor>;
}
