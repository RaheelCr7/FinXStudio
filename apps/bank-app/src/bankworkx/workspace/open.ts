import type { BankApp, LaunchPoint } from "@finx/bank-client";

/** Opens a journey from a button: a step-up first when the journey needs one and none was given in the last five minutes. */
export function openLaunch(app: BankApp, lp: LaunchPoint, passed?: Record<string, string>) {
  const t = app.launchTarget(lp, passed);
  if (lp.stepUp && app.needsStepUp(t.slug)) { void app.askStepUp({ workspace: "personal", journey: t.slug, values: Object.fromEntries(Object.entries(t.values).map(([k, v]) => [k, String(v)])) }, `To ${lp.label.toLowerCase()}.`); return; }
  void app.openJourney(t.slug, undefined, t.launch);
}
