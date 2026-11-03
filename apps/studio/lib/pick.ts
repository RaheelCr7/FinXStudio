/** Where a click landed: the block marked by the player (`fxblock:<screen>:<index in the screen>`), if the click was on one. */
export function blockAt(target: EventTarget | null): { screen: string; index: number } | null {
  const el = (target as Element | null)?.closest?.("[data-testid^='fxblock:']");
  const m = /^fxblock:(.+):(\d+)$/.exec(el?.getAttribute("data-testid") ?? "");
  return m ? { screen: m[1]!, index: Number(m[2]) } : null;
}
