/**
 * Browser side of `Query()`: every tool call goes to `/api/tool`.
 *
 * OpenUI's function-map provider needs one entry per tool name, so the names
 * are listed here. tests/toolNames.test.ts checks this list against the
 * server registry, so the two cannot drift apart.
 */
export const TOOL_NAMES = ["get_admin_dashboard"] as const;

type ToolFn = (args: Record<string, unknown>) => Promise<unknown>;

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetch("/api/tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  const body = (await response.json().catch(() => null)) as
    | { result?: unknown; error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `${name} failed with HTTP ${response.status}`);
  }
  return body?.result;
}

/** Builds the function map, calling `onSettled` after every call finishes. */
export function createToolProvider(onSettled?: () => void): Record<string, ToolFn> {
  return Object.fromEntries(
    TOOL_NAMES.map((name) => [
      name,
      (args: Record<string, unknown>) => callTool(name, args).finally(() => onSettled?.()),
    ]),
  );
}
