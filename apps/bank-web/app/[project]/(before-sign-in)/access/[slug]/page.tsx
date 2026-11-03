import { Suspense } from "react";
import { JourneyScreen } from "@/components/JourneyScreen";

/** Journeys someone can open before signing in (can't sign in, enroll, activate). Only a corporate bank links here. */
export default function BeforeSignInJourney() {
  return <Suspense fallback={null}><JourneyScreen beforeSignIn /></Suspense>;
}
