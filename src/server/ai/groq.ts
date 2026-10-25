/**
 * Calls Groq's OpenAI-compatible chat completions API with plain fetch.
 *
 * GROQ_API_KEY (and optionally GROQ_MODEL) come from .env or .env.local. Neither
 * has the NEXT_PUBLIC_ prefix, so they stay on the server and never reach the browser.
 * Models: https://console.groq.com/docs/models
 * Rate limits (429 + retry-after): https://console.groq.com/docs/rate-limits
 * Reasoning options (gpt-oss only): https://console.groq.com/docs/reasoning
 */
import { AiError } from "./errors";

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 60_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatReply {
  content: string;
  /** Tokens Groq counted for this call (prompt + answer), when it says. */
  tokens: number;
}

/**
 * gpt-oss models think before answering, and those tokens count towards the
 * per-minute limit. A recipe needs little thinking, so ask for low effort and
 * leave the reasoning out of the reply. Other models reject these options.
 */
function reasoningOptions(model: string) {
  return model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {};
}

export async function groqChat(messages: ChatMessage[]): Promise<ChatReply> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new AiError("not_configured", "GROQ_API_KEY is not set. Add it to .env and restart the dev server.");
  }
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.2, ...reasoningOptions(model) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new AiError("ai_failed", `Could not reach Groq: ${e instanceof Error ? e.message : String(e)}`);
  }

  const body = (await response.json().catch(() => null)) as
    | {
        choices?: { message?: { content?: unknown } }[];
        usage?: { total_tokens?: number };
        error?: { message?: string };
      }
    | null;

  if (response.status === 429) {
    const seconds = Math.ceil(Number(response.headers.get("retry-after")));
    const retryAfter = Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
    throw new AiError(
      "rate_limited",
      "The AI is busy: Groq's plan allows only a few requests a minute. " +
        (retryAfter ? `Try again in ${retryAfter} seconds.` : "Try again in a minute."),
      [],
      retryAfter,
    );
  }
  if (!response.ok) {
    throw new AiError("ai_failed", `Groq returned HTTP ${response.status}: ${body?.error?.message ?? "no message"}`);
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new AiError("ai_failed", "Groq returned an empty answer");
  }
  return { content, tokens: body?.usage?.total_tokens ?? 0 };
}
