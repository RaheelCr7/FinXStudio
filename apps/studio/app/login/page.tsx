import type { Metadata } from "next";
import "./signin.css";
import { SignIn } from "@/components/signin/SignIn";
import { isProduction } from "@/lib/profile";

export const metadata: Metadata = { title: "Sign in · FinX Studio" };
export const dynamic = "force-dynamic";

/** Sign-in, shown without the workspace chrome (the layout hides it for this page). Real in production; simulated in demo. */
export default function Login() {
  return <SignIn mode={isProduction() ? "production" : "demo"} />;
}
