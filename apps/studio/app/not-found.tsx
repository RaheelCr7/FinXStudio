import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page" style={{ maxWidth: 520, paddingTop: 96 }}>
      <h1>Page not found</h1>
      <p className="sub">It may have been renamed or removed.</p>
      <div className="row" style={{ marginTop: 16 }}><Link href="/" className="btn primary">Back to journeys</Link></div>
    </div>
  );
}
