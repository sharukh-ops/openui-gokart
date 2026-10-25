import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatValue } from "@/openui/format";
import PageRenderer from "@/openui/PageRenderer";
import { DASHBOARD, jsonResponse, RECIPE } from "../helpers";

// The file's recipe calls its Query `q`; this AI recipe reuses the name for another tool.
const PIE = `root = Dashboard("Orders by", "Status", [row, pie])
q = Query("get_orders_by_status", {}, {"rows":[]})
row = StatRow([first])
first = StatCard("First status", q.rows[0].orders, "orders")
pie = PieChart("Orders", "By Status", q.rows, "status", "orders")`;

describe("swapping in a recipe that reuses a Query name", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not crash while the old result is still in place", async () => {
    // Regression: PieChart called props.data.map on undefined (seen in a live HAR).
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args.map(String).join(" ")));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/layouts/")) return jsonResponse({ source: RECIPE });
        if (url === "/api/ask") return jsonResponse({ source: PIE });
        const { name } = JSON.parse(String(init?.body)) as { name: string };
        if (name !== "get_orders_by_status") return jsonResponse({ result: DASHBOARD });
        await gate;
        return jsonResponse({ result: { rows: [{ status: "SHIPPED", orders: 3, revenue: 29 }] } });
      }),
    );

    render(<PageRenderer layout="admin-dashboard" />);
    await screen.findByText("$423.40");
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "orders by status pie" } });
    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    await screen.findByText(/Showing your request/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    release();

    expect(await screen.findByText("3")).toBeTruthy();
    expect(errors).toEqual([]);
  });
});

describe("formatValue", () => {
  it("shows a dash for a value that has not arrived", () => {
    expect(formatValue(undefined)).toBe("–");
    expect(formatValue(undefined, "currency")).toBe("–");
  });
});
