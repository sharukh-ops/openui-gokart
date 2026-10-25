/**
 * Checks a recipe written by the AI before any browser sees it.
 *
 * The rules (docs/CONTEXT.md, phase two step 3):
 * 1. It parses cleanly against our library and its root is a Dashboard.
 * 2. It reads data only: no Mutation(), and only tools this caller's role may use.
 * 3. No typed-in values: numbers and chart rows come from a plain Query field
 *    such as `q.rows`, never from literals, functions or expressions.
 * 4. A dry run on the server: every Query runs through runTool, every bound
 *    field must exist in the result and fit the component's prop schema, and
 *    chart keys must be fields of the rows.
 *
 * Problems are short sentences meant to be sent back to the model. They name
 * fields and types only, never data values, so no data leaves the server.
 */
import { createParser, type ElementNode } from "@openuidev/lang-core";
import type { z } from "zod/v4";
import { serverLibrary } from "./library";
import { tools } from "@/server/tools";
import { runTool, ToolError, type ToolContext } from "@/server/tools/registry";

export const LIMITS = { sourceChars: 6000, statements: 40, queries: 4 } as const;

/** Props that must be bound to a Query field: the numbers and the rows. */
const MUST_BIND: Record<string, string[]> = {
  StatCard: ["value"],
  AreaChart: ["data"],
  BarChart: ["data"],
  PieChart: ["data"],
};

/** Props that name a field of the chart's rows. */
const ROW_KEYS: Record<string, string[]> = {
  AreaChart: ["xKey", "yKey"],
  BarChart: ["xKey", "yKey"],
  PieChart: ["nameKey", "valueKey"],
};

const parser = createParser(serverLibrary.toJSONSchema(), serverLibrary.root);

type Ast = { k: string } & Record<string, unknown>;
type Path = (string | number)[];
interface Binding {
  element: ElementNode;
  prop: string;
  query: string;
  path: Path;
}

const isAst = (v: unknown): v is Ast =>
  typeof v === "object" && v !== null && !Array.isArray(v) && typeof (v as Ast).k === "string";
const isElement = (v: unknown): v is ElementNode =>
  typeof v === "object" && v !== null && (v as ElementNode).type === "element";
const label = (el: ElementNode) => el.statementId ?? el.typeName;
const showPath = (query: string, path: Path) =>
  query + path.map((p) => (typeof p === "number" ? `[${p}]` : `.${p}`)).join("");

/** `q`, `q.a.b` or `q.rows[0].a`, read back to front. Anything else is not a plain binding. */
function readBinding(node: Ast): { query: string; path: Path } | null {
  const path: Path = [];
  let current: Ast = node;
  for (;;) {
    if (current.k === "RuntimeRef") {
      return current.refType === "query" ? { query: String(current.n), path: path.reverse() } : null;
    }
    if (current.k === "Member" && isAst(current.obj)) {
      path.push(String(current.field));
      current = current.obj;
    } else if (current.k === "Index" && isAst(current.obj) && isAst(current.index) && current.index.k === "Num") {
      path.push(Number(current.index.v));
      current = current.obj;
    } else {
      return null;
    }
  }
}

/** Plain JSON from a literal AST (Query arguments). Undefined if it is not a literal. */
function literal(node: Ast): unknown {
  switch (node.k) {
    case "Str":
    case "Num":
    case "Bool":
      return node.v;
    case "Null":
      return null;
    case "Arr": {
      const items = (node.els as Ast[]).map(literal);
      return items.includes(undefined) ? undefined : items;
    }
    case "Obj": {
      const entries = (node.entries as [string, Ast][]).map(([key, value]) => [key, literal(value)] as const);
      return entries.some(([, value]) => value === undefined) ? undefined : Object.fromEntries(entries);
    }
    default:
      return undefined;
  }
}

function resolve(value: unknown, path: Path): unknown {
  let current = value;
  for (const step of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string | number, unknown>)[step];
  }
  return current;
}

function fieldsOf(value: unknown): string {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.keys(value).join(", ")
    : "(not an object)";
}

export async function checkRecipe(source: string, ctx: ToolContext): Promise<string[]> {
  if (source.length > LIMITS.sourceChars) {
    return [`The program is too long (${source.length} characters, limit ${LIMITS.sourceChars}).`];
  }

  const result = parser.parse(source);
  const problems: string[] = [];
  if (!result.root) return ["There is no root = Dashboard(...) statement."];
  if (result.meta.incomplete) problems.push("The program is incomplete.");
  if (result.meta.statementCount > LIMITS.statements) {
    problems.push(`Too many statements (${result.meta.statementCount}, limit ${LIMITS.statements}).`);
  }
  for (const e of result.meta.errors) problems.push(`${e.statementId ?? e.component}: ${e.message}`);
  for (const name of result.meta.unresolved) problems.push(`"${name}" is used but never defined.`);
  if (result.mutationStatements.length > 0) problems.push("Mutation() is not allowed: this page may only read data.");

  // Queries: known tools, allowed for this role, literal arguments.
  if (result.queryStatements.length > LIMITS.queries) {
    problems.push(`Too many queries (${result.queryStatements.length}, limit ${LIMITS.queries}).`);
  }
  const queries = new Map<string, { tool: string; args: unknown }>();
  for (const q of result.queryStatements) {
    const tool = q.toolAST && isAst(q.toolAST) && q.toolAST.k === "Str" ? String(q.toolAST.v) : null;
    const args = q.argsAST && isAst(q.argsAST) ? literal(q.argsAST) : {};
    if (!tool) problems.push(`${q.statementId}: the tool name must be a plain string.`);
    else if (!Object.hasOwn(tools, tool)) problems.push(`${q.statementId}: there is no tool called "${tool}".`);
    else if (!tools[tool].roles.includes(ctx.role)) problems.push(`${q.statementId}: "${tool}" is not available to you.`);
    else if (args === undefined) problems.push(`${q.statementId}: Query arguments must be plain values.`);
    else queries.set(q.statementId, { tool, args });
  }

  // Walk the tree: collect bindings, reject typed-in values and expressions.
  const bindings: Binding[] = [];
  const elements: ElementNode[] = [];
  const visit = (value: unknown, element: ElementNode, prop: string) => {
    if (isElement(value)) return walk(value);
    if (Array.isArray(value)) return value.forEach((item) => visit(item, element, prop));
    if (!isAst(value)) return;
    const binding = readBinding(value);
    if (!binding) {
      problems.push(`${label(element)}: ${element.typeName}.${prop} may only use a plain Query field like q.rows.`);
    } else if (!queries.has(binding.query) && !result.meta.unresolved.includes(binding.query)) {
      problems.push(`${label(element)}: "${binding.query}" is not a valid Query.`);
    } else {
      bindings.push({ element, prop, ...binding });
    }
  };
  const walk = (element: ElementNode) => {
    elements.push(element);
    for (const [prop, value] of Object.entries(element.props)) {
      if (MUST_BIND[element.typeName]?.includes(prop) && !isAst(value)) {
        problems.push(`${label(element)}: ${element.typeName}.${prop} is typed in; it must come from a Query field.`);
      } else {
        visit(value, element, prop);
      }
    }
  };
  walk(result.root);
  if (problems.length > 0) return problems;

  // Dry run on the server with the caller's own context.
  const results = new Map<string, unknown>();
  for (const [id, { tool, args }] of queries) {
    try {
      results.set(id, await runTool(tools, tool, args, ctx));
    } catch (e) {
      problems.push(`${id}: ${e instanceof ToolError ? e.message : `${tool} failed`}`);
    }
  }
  if (problems.length > 0) return problems;

  const resolved = new Map<ElementNode, Record<string, unknown>>();
  for (const b of bindings) {
    const { tool } = queries.get(b.query)!;
    const parent = resolve(results.get(b.query), b.path.slice(0, -1));
    const value = resolve(results.get(b.query), b.path);
    if (value === undefined) {
      const isObject = typeof parent === "object" && parent !== null && !Array.isArray(parent);
      problems.push(
        `${label(b.element)}: ${showPath(b.query, b.path)} does not exist in ${tool}'s output.` +
          (isObject ? ` Fields there: ${fieldsOf(parent)}.` : " Bind a chart to the whole list instead of single rows."),
      );
      continue;
    }
    const schema = (serverLibrary.components[b.element.typeName].props as z.ZodObject).shape[b.prop];
    const check = schema?.safeParse(value);
    if (check && !check.success) {
      problems.push(
        `${label(b.element)}: ${showPath(b.query, b.path)} does not fit ${b.element.typeName}.${b.prop} ` +
          `(${check.error.issues[0]?.message ?? "wrong type"}).`,
      );
      continue;
    }
    resolved.set(b.element, { ...resolved.get(b.element), [b.prop]: value });
  }

  for (const element of elements) {
    const rows = resolved.get(element)?.data;
    if (!ROW_KEYS[element.typeName] || !Array.isArray(rows) || rows.length === 0) continue;
    for (const keyProp of ROW_KEYS[element.typeName]) {
      const key = element.props[keyProp];
      if (typeof key === "string" && !(key in (rows[0] as object))) {
        problems.push(
          `${label(element)}: ${keyProp} "${key}" is not a field of the chart's rows. Fields: ${fieldsOf(rows[0])}.`,
        );
      }
    }
  }
  return problems;
}
