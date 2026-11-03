"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Moon, Palette, Sun, Undo2, Wand2 } from "lucide-react";
import { accentProblem } from "@finx/ui-kit";
import { extractPalette, readableAccent, suggestAccent, type Swatch } from "@/lib/palette";
import { MockPhone } from "./MockPhone";
import { useProjects } from "./Projects";
import { useWho } from "./Who";

const MAX_BYTES = 15 * 1024 * 1024;

/** Reads the colours of a picture in the browser. The picture is never sent anywhere. */
async function readPicture(file: File): Promise<{ url: string; palette: Swatch[] }> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a picture (PNG, JPG, WebP or SVG).");
  if (file.size > MAX_BYTES) throw new Error("That picture is over 15 MB. Choose a smaller one.");
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error("That file could not be read as a picture.")); img.src = url; });
  const scale = Math.min(1, 140 / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return { url, palette: extractPalette(ctx.getImageData(0, 0, w, h).data) };
}

export function DesignView() {
  const router = useRouter();
  const { current } = useProjects();
  const { can } = useWho();
  const input = useRef<HTMLInputElement>(null);
  const [picture, setPicture] = useState<{ url: string; name: string; palette: Swatch[] } | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<{ previous: string; accent: string; icons?: string } | null>(null);
  const [over, setOver] = useState(false);

  async function load(file: File | undefined) {
    if (!file) return;
    setErr(""); setApplied(null);
    try {
      if (picture) URL.revokeObjectURL(picture.url);
      const p = await readPicture(file);
      setPicture({ ...p, name: file.name });
      setAccent(suggestAccent(p.palette));
      if (p.palette.length === 0) setErr("No colours found in that picture.");
    } catch (e: any) { setErr(e?.message ?? "Could not read that picture."); }
  }

  const problem = accent ? accentProblem(accent) : null;
  const same = accent?.toUpperCase() === current.accent.toUpperCase();

  async function apply(color: string, remember = true) {
    setBusy(true); setErr("");
    const res = await fetch(`/api/projects/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accent: color }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not change the colour"); return; }
    setApplied(remember ? { previous: data.previous, accent: data.accent, icons: data.iconWarning } : null);
    router.refresh();
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Design</h1>
          <p className="sub">Choose a picture of a bank&rsquo;s design. Studio finds its colours and shows <b>{current.name}</b> in them before you change anything. The picture stays in your browser.</p>
        </div>
      </div>
      {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13.5 }}>{err}</div> : null}

      <div className="design-wrap">
        <div className="stack" style={{ gap: 14 }}>
          <div className={`card drop ${over ? "over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files[0]); }}>
            {picture ? <img src={picture.url} alt={`Design: ${picture.name}`} className="design-img" /> : (
              <div className="empty" style={{ padding: 24 }}><span className="glyph"><ImagePlus size={24} aria-hidden /></span><h3>Drop a picture here</h3><p className="muted" style={{ margin: 0 }}>A screenshot of an app, a logo or a brand sheet.</p></div>
            )}
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" onClick={() => input.current?.click()}><ImagePlus size={15} aria-hidden />{picture ? "Choose another" : "Choose a picture"}</button>
              <input ref={input} type="file" accept="image/*" hidden aria-label="Choose a design picture" onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </div>

          {picture && picture.palette.length > 0 ? (
            <div className="card" style={{ gap: 12 }}>
              <h3>Colours found</h3>
              <div className="swatches" role="group" aria-label="Colours found in the picture">
                {picture.palette.map((s) => (
                  <button key={s.hex} className="swatch big" aria-label={`${s.hex}${s.chroma ? "" : ", a grey"}`} aria-pressed={accent?.toUpperCase() === s.hex} title={`${s.hex} · ${Math.round(s.share * 100)}% of the picture${s.chroma ? "" : " · grey"}`} style={{ background: s.hex, opacity: s.chroma ? 1 : 0.55 }} onClick={() => { setAccent(s.hex); setApplied(null); }} />
                ))}
              </div>
              <div className="faint">Pick the colour for buttons, links and highlights. Faded swatches are greys.</div>
              <div className="row" style={{ gap: 8 }}>
                <input aria-label="Pick a colour" type="color" value={accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#3155CE"} onChange={(e) => setAccent(e.target.value.toUpperCase())} style={{ width: 44, height: 38, border: 0, background: "none", padding: 0 }} />
                <input aria-label="Colour code" className="input mono" style={{ width: 120 }} value={accent ?? ""} placeholder="#3155CE" onChange={(e) => setAccent(e.target.value.toUpperCase())} />
                {problem && accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? <button className="btn sm" onClick={() => setAccent(readableAccent(accent))}><Wand2 size={13} aria-hidden />Make it readable</button> : null}
              </div>
              {problem ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{problem}</div> : null}
            </div>
          ) : null}
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 8 }}>
            <h3 style={{ flex: 1 }}>Before and after</h3>
            <div className="seg" role="group" aria-label="Appearance">
              <button aria-pressed={!dark} onClick={() => setDark(false)}><Sun size={14} aria-hidden />Light</button>
              <button aria-pressed={dark} onClick={() => setDark(true)}><Moon size={14} aria-hidden />Dark</button>
            </div>
          </div>
          <div className="design-phones">
            <div><div className="faint" style={{ fontWeight: 600, marginBottom: 6 }}>Now · {current.accent}</div><MockPhone name={current.name} preset={current.preset} accent={current.accent} dark={dark} /></div>
            <div><div className="faint" style={{ fontWeight: 600, marginBottom: 6 }}>{accent && !problem ? `With ${accent}` : "With the new colour"}</div>
              {accent && !problem ? <MockPhone name={current.name} preset={current.preset} accent={accent} dark={dark} /> : <div className="card empty" style={{ height: 320 }}><Palette size={22} aria-hidden /><span className="muted">Choose a picture and a colour to see it here.</span></div>}
            </div>
          </div>

          <div className="card" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn primary" disabled={!accent || !!problem || same || busy || !can("projects")} title={can("projects") ? undefined : "Your role cannot change a project's look"} onClick={() => accent && apply(accent)}>{busy ? "Changing…" : `Use for ${current.name}`}</button>
              {accent && !problem ? <Link className="btn" href={`/projects?new=1&accent=${encodeURIComponent(accent)}`}>New project with this colour</Link> : null}
            </div>
            <div className="faint">Changing the colour updates the app&rsquo;s theme (light and dark) and its icons. Apps pick it up the next time they are built; journeys are not affected.</div>
            {applied ? (
              <div className="row" role="status" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="chip pos dot">{current.name} now uses {applied.accent}</span>
                <button className="btn sm" disabled={busy} onClick={() => apply(applied.previous, false)}><Undo2 size={13} aria-hidden />Undo ({applied.previous})</button>
                {applied.icons ? <span className="faint">{applied.icons}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
