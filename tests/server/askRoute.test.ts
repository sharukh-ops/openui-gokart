import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiError } from "@/server/ai/errors";

const ask = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/server/ai/ask", () => ({ askForRecipe: ask.fn }));
vi.mock("@/server/session", () => ({ getContext: () => ({ userId: "user_1", role: "admin" }) }));

import { POST } from "@/app/api/ask/route";

function call(body: unknown) {
  const request = new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request as unknown as NextRequest);
}

describe("POST /api/ask", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the checked recipe", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    ask.fn.mockResolvedValueOnce({ source: "root = Dashboard()", attempts: 1, tokens: 900 });
    const response = await call({ question: "  revenue by store  " });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ source: "root = Dashboard()" });
    expect(ask.fn).toHaveBeenLastCalledWith("revenue by store", { userId: "user_1", role: "admin" });
  });

  it.each([[{}], [{ question: "hi" }], [{ question: "x".repeat(501) }], ["not json"]])(
    "rejects a bad body: %j",
    async (body) => {
      expect((await call(body)).status).toBe(400);
    },
  );

  it.each([
    ["not_configured", 503],
    ["rate_limited", 429],
    ["ai_failed", 502],
    ["invalid_recipe", 422],
  ] as const)("maps %s to HTTP %i", async (code, status) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    ask.fn.mockRejectedValueOnce(new AiError(code, "nope", ["a problem"]));
    const response = await call({ question: "revenue by store" });
    expect(response.status).toBe(status);
    expect((await response.json()).error).toEqual({ code, message: "nope", problems: ["a problem"] });
  });

  it("sends Retry-After when Groq said how long to wait", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    ask.fn.mockRejectedValueOnce(new AiError("rate_limited", "busy", [], 13));
    const response = await call({ question: "revenue by store" });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("13");
  });

  it("hides unexpected errors behind a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    ask.fn.mockRejectedValueOnce(new Error("secret detail"));
    const response = await call({ question: "revenue by store" });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret detail");
  });
});
