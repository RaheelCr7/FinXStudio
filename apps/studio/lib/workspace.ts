import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { GeneratedFile } from "@finx/codegen";
import { StoreError } from "./store";

const run = promisify(execFile);
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** An https address or an ssh address (git@host:owner/repo). Nothing else is accepted as a remote. */
const REMOTE = /^(https:\/\/[A-Za-z0-9.-]+(:\d+)?\/[A-Za-z0-9._~\/-]+|git@[A-Za-z0-9.-]+:[A-Za-z0-9._~\/-]+)$/;

/** Where project folders are kept: FINX_WORKSPACES_DIR, or "FinX Projects" in the home folder. */
export const workspaceRoot = () => process.env.FINX_WORKSPACES_DIR ?? path.join(os.homedir(), "FinX Projects");

export function workspaceDir(projectId: string): string {
  if (!SAFE_ID.test(projectId)) throw new StoreError(400, "That is not a valid project id");
  return path.join(workspaceRoot(), projectId);
}

/** Studio writes files to this computer only when it is being used on this computer. */
export function assertLocal(req: Request) {
  const host = new URL(req.url).hostname;
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) throw new StoreError(403, "Folders are only available when Studio is open on the computer it runs on (localhost).");
}

export type ExportResult = { dir: string; written: string[]; kept: string[]; unchanged: number };

/**
 * Writes the generated files into the project's folder. The tags decide what happens, as in the Code tab:
 * generated files are rewritten when they changed; extendable and custom files are created once and then left alone.
 */
export async function exportToFolder(projectId: string, files: GeneratedFile[]): Promise<ExportResult> {
  const dir = workspaceDir(projectId);
  const result: ExportResult = { dir, written: [], kept: [], unchanged: 0 };
  for (const f of files) {
    const target = path.resolve(dir, f.path);
    if (path.isAbsolute(f.path) || !target.startsWith(dir + path.sep)) throw new StoreError(400, `Refusing to write outside the project folder: ${f.path}`);
    const existing = await fs.readFile(target, "utf8").catch(() => null);
    if (existing !== null && f.tag !== "generated") { result.kept.push(f.path); continue; }
    if (existing === f.content) { result.unchanged++; continue; }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, f.content);
    result.written.push(f.path);
  }
  return result;
}

export type GitInfo = { initialised: boolean; branch?: string; remote?: string; changes?: number; last?: { hash: string; subject: string; when: string } };
export type WorkspaceStatus = { dir: string; exists: boolean; git: GitInfo; vscodeUrl: string };

const git = async (dir: string, args: string[]) => (await run("git", args, { cwd: dir, timeout: 20000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } })).stdout.trim();

export async function gitInfo(dir: string): Promise<GitInfo> {
  if (!(await fs.stat(path.join(dir, ".git")).catch(() => null))) return { initialised: false };
  const info: GitInfo = { initialised: true };
  info.branch = await git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "main");
  info.remote = (await git(dir, ["remote", "get-url", "origin"]).catch(() => "")) || undefined;
  info.changes = (await git(dir, ["status", "--porcelain"]).catch(() => "")).split("\n").filter(Boolean).length;
  const last = await git(dir, ["log", "-1", "--format=%h%x1f%s%x1f%cI"]).catch(() => "");
  if (last) { const [hash, subject, when] = last.split("\x1f"); info.last = { hash: hash!, subject: subject!, when: when! }; }
  return info;
}

export async function workspaceStatus(projectId: string): Promise<WorkspaceStatus> {
  const dir = workspaceDir(projectId);
  const exists = !!(await fs.stat(dir).catch(() => null));
  return { dir, exists, git: exists ? await gitInfo(dir) : { initialised: false }, vscodeUrl: `vscode://file${encodeURI(dir)}` };
}

/** Commits everything in the folder, starting the repository first when there is none. Returns the new commit, or null when nothing changed. */
export async function commitWorkspace(projectId: string, message: string, author: { name: string; id: string }): Promise<{ hash: string; subject: string } | null> {
  const dir = workspaceDir(projectId);
  if (!(await fs.stat(dir).catch(() => null))) throw new StoreError(409, "Save the project to its folder first.");
  const subject = message.trim().slice(0, 200);
  if (!subject) throw new StoreError(400, "Write a short message for the commit");
  if (!(await fs.stat(path.join(dir, ".git")).catch(() => null))) await git(dir, ["init", "-b", "main"]);
  await git(dir, ["add", "-A"]);
  if (!(await git(dir, ["status", "--porcelain"]))) return null;
  // the person's own Git name and email are used when set; otherwise the Studio person who pressed the button
  const name = (await git(dir, ["config", "user.name"]).catch(() => "")) || author.name;
  const email = (await git(dir, ["config", "user.email"]).catch(() => "")) || `${author.id}@studio.local`;
  await git(dir, ["-c", `user.name=${name}`, "-c", `user.email=${email}`, "commit", "-m", subject]);
  return { hash: await git(dir, ["rev-parse", "--short", "HEAD"]), subject };
}

/** Points "origin" at a remote. Studio never pushes: the push command is shown for the person to run with their own Git login. */
export async function setRemote(projectId: string, url: string): Promise<void> {
  const dir = workspaceDir(projectId);
  if (!REMOTE.test(url.trim())) throw new StoreError(400, "Use an https address (https://github.com/owner/repo.git) or an ssh address (git@github.com:owner/repo.git)");
  if (!(await fs.stat(path.join(dir, ".git")).catch(() => null))) throw new StoreError(409, "Commit once first so there is a repository to connect.");
  const has = await git(dir, ["remote"]).then((r) => r.split("\n").includes("origin"));
  await git(dir, ["remote", has ? "set-url" : "add", "origin", url.trim()]);
}

export const pushCommand = (dir: string, branch = "main") => `git -C "${dir}" push -u origin ${branch}`;
