/** Shared test helpers. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";
import { db } from "@/server/data/db";
import { computeAdminDashboard } from "@/server/tools/adminDashboard";

export const RECIPE = readFileSync(path.join(__dirname, "..", "layouts", "admin-dashboard.oui"), "utf-8");

export const DASHBOARD = computeAdminDashboard(db);

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface FakeServer {
  layout?: () => Response;
  tool?: (name: string, args: unknown) => Response;
}

/**
 * Replaces fetch with a fake of the two API routes. Defaults return the real
 * recipe and the real dashboard numbers.
 */
export function fakeServer({ layout, tool }: FakeServer = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/layouts/")) {
      return layout ? layout() : jsonResponse({ name: "admin-dashboard", source: RECIPE });
    }
    if (url === "/api/tool") {
      const body = JSON.parse(String(init?.body)) as { name: string; args: unknown };
      return tool ? tool(body.name, body.args) : jsonResponse({ result: DASHBOARD });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
