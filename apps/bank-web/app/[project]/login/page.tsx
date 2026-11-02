import { Suspense } from "react";
import { Login } from "@/components/Login";

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary
  return <Suspense fallback={null}><Login /></Suspense>;
}
