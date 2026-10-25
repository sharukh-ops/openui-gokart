/**
 * The Ask button's endpoint: a question in, a checked page recipe out.
 * The caller comes from the server session, the same as /api/tool.
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { askForRecipe } from "@/server/ai/ask";
import { AiError, type AiErrorCode } from "@/server/ai/errors";
import { getContext } from "@/server/session";

const Body = z.object({ question: z.string().trim().min(3).max(500) });

const STATUS: Record<AiErrorCode, number> = {
  not_configured: 503,
  rate_limited: 429,
  ai_failed: 502,
  invalid_recipe: 422,
};

export async function POST(request: NextRequest) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: { code: "bad_request", message: "Ask a question of 3 to 500 characters." } },
      { status: 400 },
    );
  }

  const started = Date.now();
  try {
    const { source, attempts, tokens } = await askForRecipe(body.data.question, getContext());
    console.info(`[ask] ok in ${Date.now() - started}ms after ${attempts} attempt(s), ${tokens} tokens`);
    return Response.json({ source });
  } catch (e) {
    if (e instanceof AiError) {
      console.warn(`[ask] ${e.code}: ${e.message}`, e.problems);
      return Response.json(
        { error: { code: e.code, message: e.message, problems: e.problems } },
        { status: STATUS[e.code], headers: e.retryAfter ? { "Retry-After": String(e.retryAfter) } : undefined },
      );
    }
    console.error("[ask] failed", e);
    return Response.json({ error: { code: "ask_failed", message: "Something went wrong. Check the server log." } }, { status: 500 });
  }
}
