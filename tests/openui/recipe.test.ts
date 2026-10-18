import { readFileSync } from "node:fs";
import path from "node:path";
import { createParser } from "@openuidev/react-lang";
import { describe, expect, it } from "vitest";
import { gocartLibrary } from "@/openui/library";
import { TOOL_NAMES } from "@/openui/toolProvider";
import { tools } from "@/server/tools";

const parser = createParser(gocartLibrary.toJSONSchema(), gocartLibrary.root);
const recipe = readFileSync(path.join(__dirname, "..", "..", "layouts", "admin-dashboard.oui"), "utf-8");

describe("admin-dashboard recipe", () => {
  const result = parser.parse(recipe);

  it("parses with no errors and nothing unresolved", () => {
    expect(result.root).not.toBeNull();
    expect(result.meta.errors).toEqual([]);
    expect(result.meta.unresolved).toEqual([]);
    expect(result.meta.orphaned).toEqual([]);
  });

  it("only queries tools that exist on the server", () => {
    const queried = [...recipe.matchAll(/Query\("([^"]+)"/g)].map((m) => m[1]);
    expect(queried.length).toBeGreaterThan(0);
    for (const name of queried) expect(Object.keys(tools)).toContain(name);
  });
});

describe("parser catches broken recipes", () => {
  it("reports an unknown component", () => {
    const broken = recipe.replace("StatRow(", "FancyRow(");
    const codes = parser.parse(broken).meta.errors.map((e) => e.code);
    expect(codes).toContain("unknown-component");
  });
});

describe("component library", () => {
  it("keeps every component, including ones that share prop shapes", () => {
    // Regression: AreaChart and BarChart once shared one schema object and AreaChart vanished.
    expect(Object.keys(gocartLibrary.components).sort()).toEqual(
      ["AreaChart", "BarChart", "Dashboard", "StatCard", "StatRow"].sort(),
    );
  });
});

describe("tool names", () => {
  it("the browser's tool list matches the server registry", () => {
    expect([...TOOL_NAMES].sort()).toEqual(Object.keys(tools).sort());
  });
});
