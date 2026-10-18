/**
 * Runs one tool for a rendered OpenUI layout (each `Query()` lands here).
 * No model is involved. The caller's identity comes from the server session,
 * never from the request body.
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { getContext } from "@/server/session";
import { tools } from "@/server/tools";
import { runTool, ToolError, type ToolErrorCode } from "@/server/tools/registry";

const Body = z.object({
  name: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
});

const STATUS: Record<ToolErrorCode, number> = {
  unknown_tool: 404,
  forbidden: 403,
  invalid_args: 400,
  invalid_output: 500,
};

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return error(400, "bad_request", "Expected { name, args }");

  const started = Date.now();
  try {
    const result = await runTool(tools, body.data.name, body.data.args, getContext());
    console.info(`[tool] ${body.data.name} ok in ${Date.now() - started}ms`);
    return Response.json({ result });
  } catch (e) {
    if (e instanceof ToolError) {
      console.warn(`[tool] ${body.data.name} ${e.code}: ${e.message}`);
      return error(STATUS[e.code], e.code, e.message);
    }
    console.error(`[tool] ${body.data.name} failed`, e);
    return error(500, "tool_failed", "The tool failed. Check the server log.");
  }
}
