import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askForRecipe, buildSystemPrompt, extractProgram } from "@/server/ai/ask";
import { AiError } from "@/server/ai/errors";
import { DEFAULT_MODEL, GROQ_URL, type ChatMessage } from "@/server/ai/groq";
import type { ToolContext } from "@/server/tools/registry";
import { jsonResponse } from "../helpers";

const admin: ToolContext = { userId: "user_1", role: "admin" };

const GOOD = `root = Dashboard("Revenue by", "Store", [chart])
q = Query("get_sales_by_store", {}, {"rows": []})
chart = BarChart("Revenue /", "Store", q.rows, "store", "revenue")`;

/** Fakes Groq: answers with each reply in turn and records what was sent. */
function fakeGroq(...replies: (string | Response)[]) {
  const sent: { model: string; messages: ChatMessage[]; reasoning_effort?: string; include_reasoning?: boolean }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe(GROQ_URL);
    sent.push(JSON.parse(String(init?.body)));
    const reply = replies[Math.min(sent.length - 1, replies.length - 1)];
    return typeof reply === "string"
      ? jsonResponse({ choices: [{ message: { content: reply } }], usage: { total_tokens: 1000 } })
      : reply;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { sent, fetchMock };
}

async function expectAiError(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AiError);
  expect((error as AiError).code).toBe(code);
  return error as AiError;
}

beforeEach(() => vi.stubEnv("GROQ_API_KEY", "test-key"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt(admin);

  it("describes the components and the caller's tools", () => {
    for (const name of ["Dashboard", "StatCard", "BarChart", "PieChart", "get_sales_by_store", "get_top_products"]) {
      expect(prompt).toContain(name);
    }
  });

  it("contains schemas only, never data", () => {
    expect(prompt).not.toContain("Happy Shop");
    expect(prompt).not.toContain("423.4");
  });

  it("stays small enough for Groq's free plan (8,000 tokens a minute)", () => {
    // About 4 characters a token: keep the prompt near 1,700 tokens so a question and a retry fit.
    expect(prompt.length).toBeLessThan(7000);
  });

  it("does not teach what the checker forbids", () => {
    expect(prompt).not.toContain("Mutation");
    expect(prompt).not.toContain("@Count");
    expect(prompt).not.toMatch(/mock data instead/i);
  });

  it("gives each tool its output shape and ready defaults", () => {
    expect(prompt).toContain("get_sales_by_store → {rows: {store: string, status: string, products: number, orders: number, revenue: number}[]}");
    expect(prompt).toContain('q = Query("get_sales_by_store", {}, {"rows":[]})');
    expect(prompt).toContain('{"products":0,"revenue":0,"orders":0,"stores":0,"ordersPerDay":[]}');
  });

  it("leaves out tools the caller's role may not use", () => {
    // Tool names still appear in the example recipe, so check a tool description instead.
    expect(prompt).toContain("One row per store");
    expect(buildSystemPrompt({ userId: "user_2", role: "shopper" })).not.toContain("One row per store");
  });
});

describe("extractProgram", () => {
  it("takes the code out of a markdown fence", () => {
    expect(extractProgram(`Here you go:\n\`\`\`openui-lang\n${GOOD}\n\`\`\`\nEnjoy!`)).toBe(GOOD);
  });

  it("keeps a bare program as it is", () => {
    expect(extractProgram(`\n${GOOD}\n`)).toBe(GOOD);
  });
});

describe("askForRecipe", () => {
  it("returns a valid recipe on the first try", async () => {
    const { sent } = fakeGroq(GOOD);
    expect(await askForRecipe("revenue by store", admin)).toEqual({ source: GOOD, attempts: 1, tokens: 1000 });
    expect(sent[0].model).toBe(DEFAULT_MODEL);
    expect(sent[0].reasoning_effort).toBe("low");
    expect(sent[0].include_reasoning).toBe(false);
    expect(sent[0].messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(sent[0].messages[1].content).toBe("revenue by store");
  });

  it("uses GROQ_MODEL when it is set", async () => {
    vi.stubEnv("GROQ_MODEL", "llama-3.3-70b-versatile");
    const { sent } = fakeGroq(GOOD);
    await askForRecipe("revenue by store", admin);
    expect(sent[0].model).toBe("llama-3.3-70b-versatile");
    expect(sent[0]).not.toHaveProperty("reasoning_effort");
  });

  it("sends the problems back once and accepts the fix", async () => {
    const typedIn = GOOD.replace("q.rows,", '[{"store": "X", "revenue": 1}],');
    const { sent } = fakeGroq(typedIn, GOOD);
    expect(await askForRecipe("revenue by store", admin)).toEqual({ source: GOOD, attempts: 2, tokens: 2000 });
    const feedback = sent[1].messages.at(-1)!;
    expect(feedback.role).toBe("user");
    expect(feedback.content).toContain("BarChart.data is typed in");
  });

  it("gives up after two bad answers and reports the problems", async () => {
    const { fetchMock } = fakeGroq("root = Nothing()");
    const error = await expectAiError(askForRecipe("anything", admin), "invalid_recipe");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error.problems.length).toBeGreaterThan(0);
  });

  it("says so when no API key is set", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const { fetchMock } = fakeGroq(GOOD);
    await expectAiError(askForRecipe("anything", admin), "not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains Groq's rate limit with the wait time", async () => {
    fakeGroq(
      new Response(JSON.stringify({ error: { message: "Rate limit reached" } }), {
        status: 429,
        headers: { "retry-after": "12.07" },
      }),
    );
    const error = await expectAiError(askForRecipe("anything", admin), "rate_limited");
    expect(error.retryAfter).toBe(13);
    expect(error.message).toContain("Try again in 13 seconds");
  });

  it("explains a rate limit without a wait time", async () => {
    fakeGroq(new Response("", { status: 429 }));
    const error = await expectAiError(askForRecipe("anything", admin), "rate_limited");
    expect(error.retryAfter).toBeUndefined();
    expect(error.message).toContain("Try again in a minute");
  });

  it("counts no tokens when Groq does not say", async () => {
    fakeGroq(jsonResponse({ choices: [{ message: { content: GOOD } }] }));
    expect((await askForRecipe("revenue by store", admin)).tokens).toBe(0);
  });

  it("passes on Groq's error message", async () => {
    fakeGroq(jsonResponse({ error: { message: "Invalid API Key" } }, 401));
    const error = await expectAiError(askForRecipe("anything", admin), "ai_failed");
    expect(error.message).toContain("Invalid API Key");
  });

  it("handles an error response with no body", async () => {
    fakeGroq(new Response("", { status: 500 }));
    expect((await expectAiError(askForRecipe("anything", admin), "ai_failed")).message).toContain("HTTP 500");
  });

  it("handles an empty answer", async () => {
    fakeGroq(jsonResponse({ choices: [] }));
    await expectAiError(askForRecipe("anything", admin), "ai_failed");
  });

  it("handles a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect((await expectAiError(askForRecipe("anything", admin), "ai_failed")).message).toContain("offline");
  });
});
