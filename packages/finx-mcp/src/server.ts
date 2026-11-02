import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createFinxServer } from "./index";
import { HttpStudioClient } from "./studio-client";

// stdout carries the protocol. Everything for humans goes to stderr.
const url = process.env.FINX_STUDIO_URL ?? "http://localhost:3100";
const readOnly = process.env.FINX_MCP_READONLY === "1";
const studio = new HttpStudioClient(url, process.env.FINX_STUDIO_TOKEN);

console.error(`[finx-mcp] ready. Studio: ${url}${readOnly ? " (read-only)" : ""}`);
serveStdio(() => createFinxServer({ studio, readOnly }));
