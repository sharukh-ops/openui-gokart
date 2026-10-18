/**
 * Tool registry: each tool is defined once, with its input/output schemas and
 * the roles allowed to call it. `/api/tool` runs tools through `runTool`, and in
 * phase two the same definitions will describe the tools to the model.
 */
import { z } from "zod/v4";

export type Role = "admin" | "seller" | "shopper";

/** Who is calling. Always built on the server, never taken from request args. */
export interface ToolContext {
  userId: string;
  role: Role;
}

export interface ToolDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  roles: readonly Role[];
  input: I;
  output: O;
  handler: (ctx: ToolContext, args: z.infer<I>) => z.infer<O> | Promise<z.infer<O>>;
}

export function defineTool<I extends z.ZodType, O extends z.ZodType>(
  def: ToolDefinition<I, O>,
): ToolDefinition<I, O> {
  return def;
}

export type ToolErrorCode = "unknown_tool" | "forbidden" | "invalid_args" | "invalid_output";

export class ToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

/**
 * Validates the call and the result. Output is checked too, so a handler bug
 * shows up as a clear error instead of a card silently drawing wrong data.
 */
export async function runTool(
  tools: Record<string, ToolDefinition>,
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const tool = Object.hasOwn(tools, name) ? tools[name] : undefined;
  if (!tool) throw new ToolError("unknown_tool", `Unknown tool: ${name}`);
  if (!tool.roles.includes(ctx.role)) {
    throw new ToolError("forbidden", `Role "${ctx.role}" may not call ${name}`);
  }

  const args = tool.input.safeParse(rawArgs ?? {});
  if (!args.success) {
    throw new ToolError("invalid_args", z.prettifyError(args.error));
  }

  const result = await tool.handler(ctx, args.data);
  const output = tool.output.safeParse(result);
  if (!output.success) {
    throw new ToolError("invalid_output", `${name} returned data that does not match its schema`);
  }
  return output.data;
}
