/**
 * The Ask flow: a question in, a checked recipe out.
 *
 * The model gets the library's prompt (library.prompt()) and the tool schemas
 * only, never the data. Its answer goes through checkRecipe; if that finds
 * problems, they go back to the model once for a corrected answer.
 *
 * library.prompt() is called with toolCalls off, and the short "Data" section
 * below describes Query and our tools instead. OpenUI's own tool sections are
 * about 7,500 characters of advice we forbid (Mutation, @functions, mock data),
 * and Groq's free plan allows only 8,000 tokens a minute for gpt-oss-120b.
 */
import { z } from "zod/v4";
import { tools } from "@/server/tools";
import type { ToolContext } from "@/server/tools/registry";
import { checkRecipe } from "./checkRecipe";
import { AiError } from "./errors";
import { groqChat, type ChatMessage } from "./groq";
import { serverLibrary } from "./library";

export const MAX_ATTEMPTS = 2;

const EXAMPLE = `root = Dashboard("Revenue by", "Store", [stats, chart])
d = Query("get_admin_dashboard", {}, {"products": 0, "revenue": 0, "orders": 0, "stores": 0, "ordersPerDay": []})
q = Query("get_sales_by_store", {}, {"rows": []})
stats = StatRow([revenue])
revenue = StatCard("Total Revenue", d.revenue, "revenue", "currency")
chart = BarChart("Revenue /", "Store", q.rows, "store", "revenue", "Revenue")`;

const RULES = [
  'Start with root = Dashboard(...) and give it a short two-part heading that fits the request, e.g. Dashboard("Orders by", "Status", [...]).',
  "Every number and every chart's data must be a plain Query field such as q.rows, q.revenue or q.rows[0].orders. Never type in numbers, names or rows, and never use mock data.",
  "Do not use @ functions, arithmetic or ternaries. Pick the tool that already returns the numbers you need.",
  "Chart keys (xKey, yKey, nameKey, valueKey) must be field names of the rows the tool returns.",
  "To show a list of items (stores, products, statuses), bind one chart to q.rows. Never make one StatCard per row such as q.rows[3]: you do not know how many rows there are.",
  'Use "currency" as the StatCard format for money (revenue).',
  "If no tool has exactly what was asked for, show the closest data the tools do have, with an honest heading.",
];

type JsonSchema = { type?: string; properties?: Record<string, JsonSchema>; items?: JsonSchema };

/** `{rows: {store: string, orders: number}[]}`: a JSON Schema in one short line. */
function shape(schema: JsonSchema): string {
  if (schema.type === "object" && schema.properties) {
    return `{${Object.entries(schema.properties).map(([key, value]) => `${key}: ${shape(value)}`).join(", ")}}`;
  }
  if (schema.type === "array" && schema.items) return `${shape(schema.items)}[]`;
  return schema.type === "integer" ? "number" : (schema.type ?? "any");
}

/** Empty defaults for a Query: 0 for numbers, [] for lists. */
function defaults(schema: JsonSchema): unknown {
  switch (schema.type) {
    case "object":
      return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => [key, defaults(value)]));
    case "array":
      return [];
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    default:
      return "";
  }
}

function dataSection(ctx: ToolContext): string {
  const allowed = Object.values(tools).filter((tool) => tool.roles.includes(ctx.role));
  const lines = allowed.map((tool) => {
    const output = z.toJSONSchema(tool.output) as JsonSchema;
    return (
      `- ${tool.name} → ${shape(output)}\n  ${tool.description}\n` +
      `  q = Query("${tool.name}", {}, ${JSON.stringify(defaults(output))})`
    );
  });
  return [
    "## Data",
    "",
    'Read data with `name = Query("tool_name", {}, defaults)`. You cannot run tools while writing: the page fetches the data when it is shown, and shows the defaults until then.',
    "Read fields with dot access: `q.revenue`, `q.rows`, `q.rows[0].orders`. Every tool takes {} as its arguments. All tools are read-only.",
    "",
    "Tools:",
    ...(lines.length > 0 ? lines : ["(none: you cannot show any data)"]),
  ].join("\n");
}

/** The system prompt for this caller: only the tools their role may use. */
export function buildSystemPrompt(ctx: ToolContext): string {
  const base = serverLibrary.prompt({
    preamble:
      "You design pages for the admin dashboard of GoCart, an online shop. The user describes the " +
      "visualisation they want; you answer with one OpenUI Lang program that draws it. " +
      "Reply with the program only: no explanation and no markdown code fences.",
    toolCalls: false,
    bindings: false,
    builtinFunctions: false,
    examples: [EXAMPLE],
    additionalRules: RULES,
  });
  return `${base}\n\n${dataSection(ctx)}`;
}

/** The program inside the first ``` fence if there is one, otherwise the whole reply. */
export function extractProgram(reply: string): string {
  const fenced = /```[\w-]*\s*\n([\s\S]*?)```/.exec(reply);
  return (fenced ? fenced[1] : reply).trim();
}

export interface AskResult {
  source: string;
  attempts: number;
  /** Groq tokens used across all attempts, for the server log. */
  tokens: number;
}

export async function askForRecipe(question: string, ctx: ToolContext): Promise<AskResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(ctx) },
    { role: "user", content: question },
  ];

  let problems: string[] = [];
  let tokens = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const reply = await groqChat(messages);
    tokens += reply.tokens;
    const source = extractProgram(reply.content);
    problems = await checkRecipe(source, ctx);
    if (problems.length === 0) return { source, attempts: attempt, tokens };
    messages.push(
      { role: "assistant", content: reply.content },
      {
        role: "user",
        content: `That program has problems:\n- ${problems.join("\n- ")}\nReply with the corrected full program only.`,
      },
    );
  }
  throw new AiError("invalid_recipe", "The AI could not build a valid page for that request. Try rephrasing it.", problems);
}
