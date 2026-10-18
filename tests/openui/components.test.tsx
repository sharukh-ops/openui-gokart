import { render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

// Give charts a real size: jsdom has no layout, so ResponsiveContainer would draw nothing.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
      cloneElement(children, { width: 800, height: 300 }),
  };
});

import { AreaChart, BarChart } from "@/openui/components/Charts";
import { Dashboard, StatRow } from "@/openui/components/Layout";
import { StatCard } from "@/openui/components/StatCard";

const noRender = () => null;
const DAYS = [
  { date: "2025-08-20", orders: 1 },
  { date: "2025-08-23", orders: 2 },
  { date: "2025-08-26", orders: 1 },
];

describe("StatCard", () => {
  it("shows the title, the value and an icon", () => {
    const { container } = render(
      <StatCard.component props={{ title: "Total Orders", value: 7, icon: "orders" }} renderNode={noRender} />,
    );
    expect(screen.getByText("Total Orders")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("formats a currency value", () => {
    render(
      <StatCard.component
        props={{ title: "Total Revenue", value: 423.4, icon: "revenue", format: "currency" }}
        renderNode={noRender}
      />,
    );
    expect(screen.getByText("$423.40")).toBeTruthy();
  });

  it.each(["products", "revenue", "orders", "stores"] as const)("renders the %s icon", (icon) => {
    const { container } = render(
      <StatCard.component props={{ title: "x", value: 1, icon }} renderNode={noRender} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("StatRow and Dashboard", () => {
  it("StatRow passes its cards to renderNode", () => {
    const renderNode = vi.fn(() => <span>cards here</span>);
    const cards = [{ type: "element" }] as never;
    render(<StatRow.component props={{ cards }} renderNode={renderNode} />);
    expect(renderNode).toHaveBeenCalledWith(cards);
    expect(screen.getByText("cards here")).toBeTruthy();
  });

  it("Dashboard shows the two-tone heading and its sections", () => {
    const renderNode = vi.fn(() => <p>sections here</p>);
    render(
      <Dashboard.component props={{ muted: "Admin", title: "Dashboard", sections: [] }} renderNode={renderNode} />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Admin Dashboard");
    expect(screen.getByText("Dashboard").className).toContain("text-slate-800");
    expect(screen.getByText("sections here")).toBeTruthy();
  });
});

describe("charts", () => {
  const props = { muted: "Orders /", title: "Day", data: DAYS, xKey: "date", yKey: "orders", yLabel: "Orders" };

  it("AreaChart shows the heading and draws an area", () => {
    const { container } = render(<AreaChart.component props={props} renderNode={noRender} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Orders / Day");
    expect(container.querySelector(".recharts-area")).not.toBeNull();
  });

  it("BarChart draws one bar per row", () => {
    const { container } = render(<BarChart.component props={props} renderNode={noRender} />);
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(DAYS.length);
  });

  it("works without a y-axis label and with no rows", () => {
    const { container } = render(
      <AreaChart.component props={{ ...props, yLabel: undefined, data: [] }} renderNode={noRender} />,
    );
    expect(screen.getByRole("heading", { level: 3 })).toBeTruthy();
    expect(container.querySelector(".recharts-label")).toBeNull();
  });
});
