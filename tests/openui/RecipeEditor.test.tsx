import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RecipeEditor from "@/openui/RecipeEditor";

describe("RecipeEditor", () => {
  it("starts closed and opens and closes the recipe", () => {
    render(<RecipeEditor value="a" original="a" onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Page recipe")).toBeNull();

    const toggle = screen.getByRole("button", { name: "Show recipe" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Page recipe")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Hide recipe" }));
    expect(screen.queryByLabelText("Page recipe")).toBeNull();
  });

  it("sends every edit to onChange", () => {
    const onChange = vi.fn();
    render(<RecipeEditor value="a" original="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Show recipe" }));
    fireEvent.change(screen.getByLabelText("Page recipe"), { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("hides Reset until the recipe differs from the file", () => {
    const { rerender } = render(<RecipeEditor value="a" original="a" onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Reset to file" })).toBeNull();

    const onChange = vi.fn();
    rerender(<RecipeEditor value="edited" original="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset to file" }));
    expect(onChange).toHaveBeenCalledWith("a");
  });
});
