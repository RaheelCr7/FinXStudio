import { Frame } from "@/components/Frame";
import { Guard } from "@/components/Guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Guard><Frame>{children}</Frame></Guard>;
}
