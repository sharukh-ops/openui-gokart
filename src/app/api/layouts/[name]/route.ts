/**
 * Serves a page recipe (OpenUI Lang) from the `layouts/` folder.
 *
 * Read on every request so an edited recipe shows up without a rebuild. In phase
 * two this becomes a database read behind the same URL.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

const LAYOUT_DIR = path.join(process.cwd(), "layouts");
const SAFE_NAME = /^[a-z0-9-]+$/;

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/layouts/[name]">) {
  const { name } = await ctx.params;
  if (!SAFE_NAME.test(name)) {
    return Response.json({ error: { code: "bad_name", message: "Invalid layout name" } }, { status: 400 });
  }

  try {
    const source = await readFile(path.join(LAYOUT_DIR, `${name}.oui`), "utf-8");
    return Response.json({ name, source });
  } catch {
    return Response.json({ error: { code: "not_found", message: `No layout called ${name}` } }, { status: 404 });
  }
}
