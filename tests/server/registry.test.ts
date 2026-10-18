import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { tools } from "@/server/tools";
import { defineTool, runTool, ToolError, type ToolDefinition } from "@/server/tools/registry";

const admin = { userId: "user_1", role: "admin" as const };
const shopper = { userId: "user_2", role: "shopper" as const };

async function expectToolError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ToolError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe("runTool", () => {
  it("returns the dashboard for an admin", async () => {
    const result = (await runTool(tools, "get_admin_dashboard", {}, admin)) as { orders: number };
    expect(result.orders).toBe(7);
  });

  it("rejects an unknown tool", async () => {
    await expectToolError(runTool(tools, "drop_tables", {}, admin), "unknown_tool");
  });

  it("does not treat inherited object keys as tools", async () => {
    await expectToolError(runTool(tools, "toString", {}, admin), "unknown_tool");
  });

  it("rejects a caller whose role is not allowed", async () => {
    await expectToolError(runTool(tools, "get_admin_dashboard", {}, shopper), "forbidden");
  });

  it("rejects arguments the schema does not list", async () => {
    await expectToolError(runTool(tools, "get_admin_dashboard", { userId: "user_2" }, admin), "invalid_args");
  });

  it("treats missing args as an empty object", async () => {
    await expect(runTool(tools, "get_admin_dashboard", undefined, admin)).resolves.toBeTruthy();
  });

  it("rejects a handler result that does not match the output schema", async () => {
    const broken = defineTool({
      name: "broken",
      description: "test",
      roles: ["admin"],
      input: z.object({}),
      output: z.object({ count: z.number() }),
      handler: () => ({ count: "seven" }) as unknown as { count: number },
    });
    const registry = { broken: broken as unknown as ToolDefinition };
    await expectToolError(runTool(registry, "broken", {}, admin), "invalid_output");
  });
});
