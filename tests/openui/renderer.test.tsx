/**
 * The real recipe drawn by OpenUI's real Renderer with our library: proves the
 * recipe, the components and the Query binding work together.
 */
import { Renderer } from "@openuidev/react-lang";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { gocartLibrary } from "@/openui/library";
import { DASHBOARD, RECIPE } from "../helpers";

function drawRecipe(recipe: string, tool = vi.fn(async () => DASHBOARD)) {
  render(<Renderer response={recipe} library={gocartLibrary} toolProvider={{ get_admin_dashboard: tool }} />);
  return tool;
}

describe("admin-dashboard recipe in the Renderer", () => {
  it("shows the four cards with the tool's numbers", async () => {
    const tool = drawRecipe(RECIPE);
    expect(await screen.findByText("$423.40")).toBeTruthy();
    for (const label of ["Total Products", "Total Revenue", "Total Orders", "Total Stores"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(tool).toHaveBeenCalledWith({});
  });

  it("shows the chart heading", async () => {
    drawRecipe(RECIPE);
    expect((await screen.findByRole("heading", { level: 3 })).textContent).toBe("Orders / Day");
  });

  it("changes the page when the recipe changes, with no code change", async () => {
    drawRecipe(RECIPE.replace('"Total Products"', '"All Products"'));
    expect(await screen.findByText("All Products")).toBeTruthy();
    expect(screen.queryByText("Total Products")).toBeNull();
  });

  it("reports an unknown component through onError", async () => {
    const onError = vi.fn();
    render(
      <Renderer
        response={RECIPE.replace("StatRow(", "FancyRow(")}
        library={gocartLibrary}
        toolProvider={{ get_admin_dashboard: async () => DASHBOARD }}
        onError={onError}
      />,
    );
    await screen.findByRole("heading", { level: 1 });
    const codes = onError.mock.calls.flatMap(([errors]) => errors.map((e: { code: string }) => e.code));
    expect(codes).toContain("unknown-component");
  });
});
