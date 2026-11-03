/**
 * A small, strict JSON Patch (RFC 6902) subset: add, replace, remove and test.
 * Paths are JSON Pointers such as /screens/2/blocks/1/label. Applies to a copy and either succeeds fully or throws.
 */
export type PatchOp = { op: "add" | "replace" | "remove" | "test"; path: string; value?: unknown };

export class PatchError extends Error {
  constructor(public index: number, message: string) { super(`Operation ${index + 1}: ${message}`); this.name = "PatchError"; }
}

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

function parsePointer(path: string, index: number): string[] {
  if (path === "") throw new PatchError(index, "the path must not be empty (replace a part of the journey, not all of it)");
  if (!path.startsWith("/")) throw new PatchError(index, `the path "${path}" must start with "/", for example /screens/0/title`);
  return path.slice(1).split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

const isIndex = (s: string) => /^(0|[1-9][0-9]*)$/.test(s);

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  return ka.length === kb.length && ka.every((k) => deepEqual((a as any)[k], (b as any)[k]));
}

export function applyPatch<T>(doc: T, ops: PatchOp[]): T {
  const root: any = structuredClone(doc);
  ops.forEach((op, index) => {
    const segs = parsePointer(op.path, index);
    for (const s of segs) if (FORBIDDEN.has(s)) throw new PatchError(index, `the path segment "${s}" is not allowed`);
    const last = segs[segs.length - 1]!;
    let parent: any = root;
    for (const s of segs.slice(0, -1)) {
      parent = Array.isArray(parent) ? (isIndex(s) ? parent[Number(s)] : undefined) : parent?.[s];
      if (parent === undefined || parent === null || typeof parent !== "object") throw new PatchError(index, `the path ${op.path} does not exist (nothing at "${s}")`);
    }
    const arr = Array.isArray(parent);
    if (arr && last !== "-" && !isIndex(last)) throw new PatchError(index, `"${last}" is not a valid array index in ${op.path}`);
    const key: string | number = arr ? (last === "-" ? parent.length : Number(last)) : last;
    switch (op.op) {
      case "add":
        if (op.value === undefined) throw new PatchError(index, "add needs a value");
        if (arr) { if (key > parent.length) throw new PatchError(index, `index ${key} is past the end of the list (${parent.length} items)`); parent.splice(key as number, 0, structuredClone(op.value)); }
        else parent[key] = structuredClone(op.value);
        break;
      case "replace":
        if (op.value === undefined) throw new PatchError(index, "replace needs a value");
        if (arr ? (key as number) >= parent.length : !(key in parent)) throw new PatchError(index, `nothing to replace at ${op.path}; use add to create it`);
        parent[key] = structuredClone(op.value);
        break;
      case "remove":
        if (arr ? (key as number) >= parent.length : !(key in parent)) throw new PatchError(index, `nothing to remove at ${op.path}`);
        if (arr) parent.splice(key as number, 1); else delete parent[key];
        break;
      case "test":
        if (!deepEqual(parent[key], op.value)) throw new PatchError(index, `the value at ${op.path} is not what the test expected`);
        break;
    }
  });
  return root;
}
