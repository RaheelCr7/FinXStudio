import Link from "next/link";
import { defaultProjectId, listProjects } from "@/lib/projects";

export default async function Home() {
  const projects = await listProjects();
  const fallback = await defaultProjectId();
  return (
    <main className="wb-chooser">
      <h1>FinX web banking</h1>
      <p className="wb-muted">Choose a bank to open. Everything here is a sandbox: no real money moves.</p>
      <ul>
        {projects.map((p) => (
          <li key={p.id}><Link className="wb-chooser-card" href={`/${p.id}/login`}><span className="wb-mark" style={{ background: p.def.accent }} aria-hidden>{p.def.name.slice(0, 1)}</span><span><b>{p.def.name}</b><small>{p.def.preset === "bankworkx" ? "Money management" : "Classic banking"} · {p.def.currency}{p.id === fallback ? " · default" : ""}</small></span></Link></li>
        ))}
      </ul>
    </main>
  );
}
