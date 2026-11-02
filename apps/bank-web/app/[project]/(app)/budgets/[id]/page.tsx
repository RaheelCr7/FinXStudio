"use client";
import { OnlyFor } from "@/components/Frame";
import { BudgetDetail } from "@/components/bankworkx/Tabs";

export default function Page() {
  return <OnlyFor shell="bankworkx"><BudgetDetail /></OnlyFor>;
}
