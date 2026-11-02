import { Suspense } from "react";
import { JourneyScreen } from "@/components/JourneyScreen";

export default function JourneyPage() {
  // useSearchParams needs a Suspense boundary
  return <Suspense fallback={null}><JourneyScreen /></Suspense>;
}
