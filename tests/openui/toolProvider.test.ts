import { afterEach, describe, expect, it, vi } from "vitest";
import { callTool, createToolProvider, TOOL_NAMES } from "@/openui/toolProvider";
import { jsonResponse } from "../helpers";

describe("callTool", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the tool name and args to /api/tool and returns the result", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ result: { orders: 7 } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(callTool("get_admin_dashboard", { a: 1 })).resolves.toEqual({ orders: 7 });
    expect(fetchMock).toHaveBeenCalledWith("/api/tool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "get_admin_dashboard", args: { a: 1 } }),
    });
  });

  it("throws the server's error message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "Role not allowed" } }, 403)));
    await expect(callTool("x", {})).rejects.toThrow("Role not allowed");
  });

  it("throws a status message when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>oops</html>", { status: 502 })));
    await expect(callTool("x", {})).rejects.toThrow("x failed with HTTP 502");
  });

  it("passes network errors through", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(callTool("x", {})).rejects.toThrow("Failed to fetch");
  });
});

describe("createToolProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("has one function per tool name", () => {
    expect(Object.keys(createToolProvider())).toEqual([...TOOL_NAMES]);
  });

  it("calls onSettled after a success and after a failure", async () => {
    const onSettled = vi.fn();
    const provider = createToolProvider(onSettled);

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ result: 1 })));
    await provider.get_admin_dashboard({});
    expect(onSettled).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "down" } }, 500)));
    await expect(provider.get_admin_dashboard({})).rejects.toThrow("down");
    expect(onSettled).toHaveBeenCalledTimes(2);
  });
});
