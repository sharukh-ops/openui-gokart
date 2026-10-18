import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ role: "admin" as "admin" | "shopper" }));
vi.mock("@/server/session", () => ({
  getContext: () => ({ userId: "user_1", role: session.role }),
}));

import { POST } from "@/app/api/tool/route";
import { tools } from "@/server/tools";

function call(body: unknown, raw = false) {
  const request = new Request("http://localhost/api/tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? String(body) : JSON.stringify(body),
  });
  return POST(request as unknown as NextRequest);
}

describe("POST /api/tool", () => {
  afterEach(() => {
    session.role = "admin";
    vi.restoreAllMocks();
  });

  it("returns the tool result", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await call({ name: "get_admin_dashboard", args: {} });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result).toMatchObject({ products: 12, revenue: 423.4, orders: 7, stores: 2 });
  });

  it("accepts a call without args", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await call({ name: "get_admin_dashboard" });
    expect(response.status).toBe(200);
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await call("not json", true);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("bad_request");
  });

  it("returns 400 for a body without a tool name", async () => {
    const response = await call({ args: {} });
    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown tool", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await call({ name: "delete_everything" });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("unknown_tool");
  });

  it("returns 400 when args contain a field the tool does not accept", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await call({ name: "get_admin_dashboard", args: { userId: "user_2" } });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_args");
  });

  it("returns 403 when the caller's role may not use the tool", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    session.role = "shopper";
    const response = await call({ name: "get_admin_dashboard" });
    expect(response.status).toBe(403);
  });

  it("returns 500 without leaking details when a handler crashes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(tools.get_admin_dashboard, "handler").mockImplementation(() => {
      throw new Error("secret database detail");
    });
    const response = await call({ name: "get_admin_dashboard" });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("tool_failed");
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
