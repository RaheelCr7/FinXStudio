/**
 * Smoke test: starts the real MCP server as a child process over stdio (exactly how Claude Code does) and
 * exercises it against a running FinX Studio. Read-only: it changes nothing in Studio.
 *   pnpm --filter @finx/mcp smoke        (Studio must be running: cd apps/studio && pnpm dev)
 */
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const studio = process.env.FINX_STUDIO_URL ?? "http://localhost:3100";

async function main() {
  const transport = new StdioClientTransport({
    command: join(root, "node_modules", ".bin", "tsx"),
    args: [join(root, "packages", "finx-mcp", "src", "server.ts")],
    env: { ...getDefaultEnvironment(), FINX_STUDIO_URL: studio, FINX_MCP_READONLY: "1" },
    cwd: root,
    stderr: "inherit",
  });
  const client = new Client({ name: "finx-smoke", version: "0" });
  await client.connect(transport);

  let failed = 0;
  const check = (name: string, pass: boolean, detail = "") => { console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`); if (!pass) failed++; };
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r: any = await client.callTool({ name, arguments: args });
    const text: string = r.content?.[0]?.text ?? "";
    let json: any; try { json = JSON.parse(text); } catch { /* plain text */ }
    return { isError: !!r.isError, text, json };
  };

  const tools = (await client.listTools()).tools.map((t) => t.name);
  check("11 tools are advertised", tools.length === 11, tools.join(", "));

  const catalog = await call("finx_get_catalog", { section: "adapters" });
  check("catalog lists the sandbox adapters", catalog.json?.adapters?.list?.length === 11);

  const list = await call("finx_list_journeys");
  check("Studio is reachable and lists journeys", !list.isError && Array.isArray(list.json?.journeys), list.isError ? list.text : `${list.json.journeys.length} journeys`);
  const first = list.json?.journeys?.find((j: any) => j.slug === "fund-transfer-local");

  if (first) {
    const got = await call("finx_get_journey", { slug: "fund-transfer-local" });
    check("a live journey passes lint", got.json?.issues?.length === 0, `v${got.json?.publishedVersion}`);
  }

  // Simulate the shipped example, so the check does not depend on what has been edited in Studio.
  const example = await call("finx_get_example", { name: "fund-transfer-local" });
  const sim = await call("finx_simulate_journey", {
    journey: example.json,
    steps: [
      { set: { "transfer.fromAccountId": "acc_current" } }, { press: "Continue" }, { expectScreen: "beneficiary" },
      { set: { "transfer.beneficiaryId": "ben_4821" } }, { press: "Continue" },
      { set: { "transfer.amount": 25000, "transfer.purpose": "Rent" } }, { press: "Continue" }, { expectScreen: "review" },
    ],
  });
  check("the example journey runs in the sandbox", sim.json?.ok === true, sim.json?.failures?.join("; ") ?? sim.text);

  const blocked = await call("finx_save_draft", { journey: { nope: true } });
  check("read-only mode refuses writes", blocked.isError && blocked.text.includes("read-only"));

  await client.close();
  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
