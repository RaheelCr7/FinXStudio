"use client";
import { OnlyFor } from "@/components/Frame";
import { InstrumentDetail } from "@/components/bankworkx/Invest";

export default function Page() {
  return <OnlyFor shell="bankworkx"><InstrumentDetail /></OnlyFor>;
}
