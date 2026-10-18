import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/layouts/[name]/route";
import { RECIPE } from "../helpers";

function get(name: string) {
  const request = new Request(`http://localhost/api/layouts/${encodeURIComponent(name)}`);
  const ctx = { params: Promise.resolve({ name }) } as Parameters<typeof GET>[1];
  return GET(request as unknown as NextRequest, ctx);
}

describe("GET /api/layouts/[name]", () => {
  it("returns the recipe file", async () => {
    const response = await get("admin-dashboard");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "admin-dashboard", source: RECIPE });
  });

  it("returns 404 for a recipe that does not exist", async () => {
    const response = await get("no-such-page");
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });

  it.each(["../package", "..\\secrets", "Admin", "a.b", "", "admin dashboard"])(
    "rejects the unsafe name %j",
    async (name) => {
      const response = await get(name);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("bad_name");
    },
  );
});
