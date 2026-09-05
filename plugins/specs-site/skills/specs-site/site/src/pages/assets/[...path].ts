import type { APIRoute, GetStaticPaths } from "astro";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { SPECS_DIR, listFiles } from "../../lib/specs.mjs";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".html": "text/html; charset=utf-8",
};

// Diagrams, screenshots and mockups under specs/**, served verbatim.
export const getStaticPaths: GetStaticPaths = () =>
  listFiles(".", Object.keys(TYPES))
    .filter((p) => !p.startsWith("legacy/"))
    .map((p) => ({ params: { path: p } }));

export const GET: APIRoute = ({ params }) => {
  const rel = normalize(params.path ?? "");
  const type = TYPES[extname(rel)];
  if (!type || rel.startsWith("..") || rel.startsWith("legacy/")) return new Response("not found", { status: 404 });
  try {
    return new Response(readFileSync(join(SPECS_DIR, rel)), { headers: { "content-type": type } });
  } catch {
    return new Response("not found", { status: 404 });
  }
};
