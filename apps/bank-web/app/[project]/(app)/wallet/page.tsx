"use client";
import { OnlyFor } from "@/components/Frame";
import { Wallet } from "@/components/bankworkx/Tabs";

export default function Page() {
  return <OnlyFor shell="bankworkx"><Wallet /></OnlyFor>;
}
