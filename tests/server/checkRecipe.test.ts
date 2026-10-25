import { describe, expect, it } from "vitest";
import { checkRecipe, LIMITS } from "@/server/ai/checkRecipe";
import type { ToolContext } from "@/server/tools/registry";
import { RECIPE } from "../helpers";

const admin: ToolContext = { userId: "user_1", role: "admin" };
const shopper: ToolContext = { userId: "user_2", role: "shopper" };

const SALES = `root = Dashboard("Revenue by", "Store", [chart])
q = Query("get_sales_by_store", {}, {"rows": []})
chart = BarChart("Revenue /", "Store", q.rows, "store", "revenue")`;

/** Runs the check and returns the problems as one string, for easy matching. */
async function problems(source: string, ctx = admin) {
  return (await checkRecipe(source, ctx)).join("\n");
}

describe("checkRecipe accepts", () => {
  it("the hand-written admin dashboard recipe", async () => {
    expect(await checkRecipe(RECIPE, admin)).toEqual([]);
  });

  it("a chart bound to a breakdown tool", async () => {
    expect(await checkRecipe(SALES, admin)).toEqual([]);
  });

  it("a pie chart and an indexed binding", async () => {
    const source = `root = Dashboard("Orders by", "Status", [row, pie])
q = Query("get_orders_by_status", {}, {"rows": []})
row = StatRow([top])
top = StatCard("Biggest status", q.rows[0].orders, "orders")
pie = PieChart("Orders by", "Status", q.rows, "status", "orders")`;
    expect(await checkRecipe(source, admin)).toEqual([]);
  });
});

describe("checkRecipe rejects", () => {
  it("a program that does not parse to a Dashboard", async () => {
    expect(await problems("hello there")).toContain("no root");
  });

  it("a program over the size limit", async () => {
    expect(await problems(SALES + " ".repeat(LIMITS.sourceChars))).toContain("too long");
  });

  it("unknown components", async () => {
    expect(await problems(SALES.replace("BarChart(", "FancyChart("))).not.toBe("");
  });

  it("names used but never defined", async () => {
    expect(await problems(SALES.replace("[chart]", "[chart, extra]"))).toContain('"extra" is used but never defined');
  });

  it("Mutation()", async () => {
    expect(await problems(`${SALES}\nm = Mutation("delete_store", {})`)).toContain("Mutation() is not allowed");
  });

  it("an unknown tool", async () => {
    expect(await problems(SALES.replace("get_sales_by_store", "get_passwords"))).toContain(
      'there is no tool called "get_passwords"',
    );
  });

  it("a tool the caller's role may not use", async () => {
    expect(await problems(SALES, shopper)).toContain('"get_sales_by_store" is not available to you');
  });

  it("arguments the tool does not accept (dry run)", async () => {
    const source = SALES.replace('Query("get_sales_by_store", {}', 'Query("get_sales_by_store", {"userId": "user_2"}');
    expect(await problems(source)).toMatch(/^q: /);
  });

  it("a typed-in number", async () => {
    const source = RECIPE.replace("q.products", "999");
    expect(await problems(source)).toContain("StatCard.value is typed in");
  });

  it("typed-in chart rows", async () => {
    const source = SALES.replace("q.rows,", '[{"store": "Fake", "revenue": 1}],');
    expect(await problems(source)).toContain("BarChart.data is typed in");
  });

  it("functions and expressions instead of a plain field", async () => {
    const source = RECIPE.replace("q.products", "@Count(q.ordersPerDay)");
    expect(await problems(source)).toContain("may only use a plain Query field");
  });

  it("a field the tool does not return, naming the fields it does", async () => {
    const source = SALES.replace("q.rows", "q.stores");
    const found = await problems(source);
    expect(found).toContain("q.stores does not exist in get_sales_by_store's output");
    expect(found).toContain("Fields there: rows");
  });

  it("a row that does not exist, pointing at a chart instead", async () => {
    const source = `root = Dashboard("Top", "Products", [row])
q = Query("get_top_products", {}, {"rows": []})
row = StatRow([card])
card = StatCard("Twelfth", q.rows[11].unitsSold, "products")`;
    const found = await problems(source);
    expect(found).toContain("q.rows[11].unitsSold does not exist");
    expect(found).toContain("Bind a chart to the whole list");
    expect(found).not.toContain("(not an object)");
  });

  it("a field of the wrong type for the prop", async () => {
    const source = `root = Dashboard("A", "B", [row])
q = Query("get_sales_by_store", {}, {"rows": []})
row = StatRow([card])
card = StatCard("Stores", q.rows, "stores")`;
    expect(await problems(source)).toContain("q.rows does not fit StatCard.value");
  });

  it("chart keys that are not fields of the rows", async () => {
    const found = await problems(SALES.replace('"store", "revenue"', '"shop", "revenue"'));
    expect(found).toContain('xKey "shop" is not a field');
    expect(found).toContain("Fields: store, status, products, orders, revenue");
  });

  it("too many queries", async () => {
    const extra = Array.from({ length: LIMITS.queries }, (_, i) => `x${i} = Query("get_top_products", {}, {"rows": []})`);
    expect(await problems([SALES, ...extra].join("\n"))).toContain("Too many queries");
  });

  it("never puts data values in a problem", async () => {
    const found = await problems(SALES.replace('"store", "revenue"', '"shop", "revenue"'));
    expect(found).not.toContain("Happy Shop");
    expect(found).not.toContain("307.4");
  });
});
