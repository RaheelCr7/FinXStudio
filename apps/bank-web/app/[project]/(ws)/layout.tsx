import { Guard } from "@/components/Guard";
import { WorkspaceFrame } from "@/components/ws/WorkspaceFrame";

/** Personal (/<project>/personal/...) and Business (/<project>/business/<company>/...): one frame, drawn for the place the customer is in. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Guard><WorkspaceFrame>{children}</WorkspaceFrame></Guard>;
}
