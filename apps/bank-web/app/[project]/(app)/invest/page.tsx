"use client";
import { OnlyFor } from "@/components/Frame";
import { InvestHome } from "@/components/bankworkx/Invest";

export default function Page() {
  return <OnlyFor shell="bankworkx"><InvestHome /></OnlyFor>;
}
