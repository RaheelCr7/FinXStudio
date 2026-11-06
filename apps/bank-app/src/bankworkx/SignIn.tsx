import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { isPublicJourney, landingPointsFor, slugIs, type BankApp, type Live } from "@finx/bank-client";
import { JourneyPlayer, useTheme } from "@finx/renderer-native";
import { useBankApp } from "../useBankApp";

/**
 * Sign in on the phone: the sign-in journey signs the customer in at the sandbox bank, and the app then asks the bank who is signed in
 * (`finishSignIn`). The journey hands over to forgot password, forgot username and unlock, and each of them ends back here. The sandbox
 * customer picker is one quiet link away, for development.
 */
export function SignIn({ app, lang }: { app: BankApp; lang?: string }) {
  const { c } = useTheme();
  const st = useBankApp(app);
  // signed out for their security (a timeout): the sign-in journey says so; a lock says it here
  const reason = st.notice === "expired" ? { "launch.reason": "expired" } : undefined;
  // which journey is on screen and the values it was opened with; n makes a journey that is opened again start again
  const [run, setRun] = useState<{ slug: string; launch?: Record<string, any>; n: number }>({ slug: "sign-in", n: 0 });
  const [live, setLive] = useState<Live | null | "loading">("loading");
  // where the journey is: the Landing shows only on the first screen the person sees (the sign-in form), not on the steps after the password
  // an event says which journey it came from: the screen it shows first is the sign-in form, and only while it is on that screen is the Landing under it
  const [at, setAt] = useState<{ slug?: string; first?: string; now?: string }>({});
  const onEvent = (e: { type: string; screen?: string; kind?: string; slug?: string }) => { if (e.type === "screen" && e.kind !== "branch") setAt((cur) => (cur.slug === e.slug ? { ...cur, now: e.screen } : { slug: e.slug, first: e.screen, now: e.screen })); };
  useEffect(() => {
    let alive = true;
    setLive("loading");
    void app.fetchJourney(run.slug).then((l) => { if (alive) setLive(l); });
    return () => { alive = false; };
  }, [app, run]);

  // a journey that needs a customer cannot start before sign-in: the person is taken to the sign-in
  const open = (r: { journey: string; launch: Record<string, any> }) => setRun((cur) => ({ slug: isPublicJourney(r.journey) ? app.resolveSlug(r.journey) : "sign-in", launch: isPublicJourney(r.journey) ? r.launch : undefined, n: cur.n + 1 }));
  // the Landing under the sign-in: the actions before signing in, and Explore (the same list as the web)
  const points = slugIs(run.slug, "sign-in") && live && slugIs(at.slug ?? "", "sign-in") && at.now === at.first && !app.bank.signedIn ? landingPointsFor(st.catalog.entries) : [];
  // a journey ended: when the bank now serves a customer the app opens it, otherwise the sign-in starts again
  const ended = () => { if (!app.finishSignIn()) setRun((cur) => ({ slug: "sign-in", n: cur.n + 1 })); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1 }}>
        {st.notice === "locked" ? <Text accessibilityRole="alert" style={{ color: c.warning, fontWeight: "600", padding: 16 }}>Sign-in is locked to protect your account. Unlock it to continue.</Text> : null}
        {live === "loading" ? null : live ? (
          <JourneyPlayer key={`${run.slug}:${run.n}`} journey={live.journey} adapter={app.adapter} lang={lang} launch={run.launch ?? reason} onOpenJourney={open} onEvent={onEvent} onClose={ended} onExit={ended} />
        ) : (
          <View style={{ padding: 24, gap: 8 }}>
            <Text accessibilityRole="header" style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>Sign in is not available right now</Text>
            <Text style={{ color: c.textMuted }}>The sign-in journey could not be loaded. You can still use the sandbox customer picker.</Text>
          </View>
        )}
      </View>
      {points.length ? (
        <View accessibilityLabel="Before you sign in" style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4, paddingHorizontal: 12 }}>
          {points.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" onPress={() => open({ journey: p.journey, launch: {} })} style={{ minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: p.group === "main" ? "700" : "500", textDecorationLine: p.group === "link" ? "underline" : "none" }}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => app.showPicker(true)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: c.textFaint, fontSize: 12, textDecorationLine: "underline" }}>Use the sandbox customer picker</Text>
      </Pressable>
    </View>
  );
}
