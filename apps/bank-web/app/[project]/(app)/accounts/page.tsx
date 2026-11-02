"use client";
import { OnlyFor } from "@/components/Frame";
import { Accounts } from "@/components/bankworkx/Tabs";

export default function Page() {
  return <OnlyFor shell="bankworkx"><Accounts /></OnlyFor>;
}
