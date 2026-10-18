import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import PageRenderer from "@/openui/PageRenderer";
import { DASHBOARD, fakeServer, jsonResponse, RECIPE } from "../helpers";

describe("PageRenderer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows GoCart's spinner first, then the dashboard", async () => {
    fakeServer();
    const { container } = render(<PageRenderer layout="admin-dashboard" />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(await screen.findByText("$423.40")).toBeTruthy();
    await waitFor(() => expect(container.querySelector(".animate-spin")).toBeNull());
  });

  it("asks for the right recipe", async () => {
    const fetchMock = fakeServer();
    render(<PageRenderer layout="admin-dashboard" />);
    await screen.findByText("$423.40");
    expect(fetchMock).toHaveBeenCalledWith("/api/layouts/admin-dashboard");
  });

  it("never shows the zero defaults as if they were real numbers", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    fakeServer({ tool: () => jsonResponse({ result: DASHBOARD }) });
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/tool") await gate;
      return realFetch(input, init);
    });

    render(<PageRenderer layout="admin-dashboard" />);
    await waitFor(() => expect(screen.queryByText("Total Products")).not.toBeNull());
    const content = screen.getByText("Total Products").closest("[hidden]");
    expect(content).not.toBeNull();
    release();
    expect(await screen.findByText("$423.40")).toBeTruthy();
  });

  it("ignores a recipe or an error that arrives after the page was left", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const layout of [
      () => jsonResponse({ source: RECIPE }),
      () => jsonResponse({ error: { message: "gone" } }, 404),
    ]) {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      fakeServer({ layout });
      const realFetch = globalThis.fetch;
      vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        await gate;
        return realFetch(input, init);
      });
      const { unmount } = render(<PageRenderer layout="admin-dashboard" />);
      unmount();
      release();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("explains when the recipe cannot be loaded", async () => {
    fakeServer({ layout: () => jsonResponse({ error: { message: "No layout called admin-dashboard" } }, 404) });
    render(<PageRenderer layout="admin-dashboard" />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not load the page recipe");
    expect(alert.textContent).toContain("No layout called admin-dashboard");
  });

  it("explains when the recipe request fails with no message", async () => {
    fakeServer({ layout: () => new Response("", { status: 500 }) });
    render(<PageRenderer layout="admin-dashboard" />);
    expect((await screen.findByRole("alert")).textContent).toContain("Could not load the page recipe");
  });

  it("shows Try again when the data fails, and recovers on retry", async () => {
    let fail = true;
    fakeServer({
      tool: () => (fail ? jsonResponse({ error: { message: "db down" } }, 500) : jsonResponse({ result: DASHBOARD })),
    });
    render(<PageRenderer layout="admin-dashboard" />);
    expect(await screen.findByText("Could not load the dashboard data.")).toBeTruthy();

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("$423.40")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Could not load the dashboard data.")).toBeNull());
  });

  it("warns about a broken recipe instead of showing a blank page", async () => {
    fakeServer({ layout: () => jsonResponse({ source: RECIPE.replace("StatRow(", "FancyRow(") }) });
    render(<PageRenderer layout="admin-dashboard" />);
    expect(await screen.findByText("The page recipe has problems, so parts may be missing:")).toBeTruthy();
    expect(screen.getByText(/FancyRow/)).toBeTruthy();
  });

  it("renders a recipe that has no Query without waiting for data", async () => {
    const fetchMock = fakeServer({ layout: () => jsonResponse({ source: 'root = Dashboard("Hello", "World", [])' }) });
    render(<PageRenderer layout="admin-dashboard" />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Hello World");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/tool", expect.anything());
  });

  it("offers the recipe editor outside production, and edits update the page", async () => {
    fakeServer();
    render(<PageRenderer layout="admin-dashboard" />);
    await screen.findByText("$423.40");

    fireEvent.click(screen.getByRole("button", { name: "Show recipe" }));
    const editor = screen.getByLabelText("Page recipe") as HTMLTextAreaElement;
    expect(editor.value).toBe(RECIPE);

    fireEvent.change(editor, { target: { value: RECIPE.replace('"Total Orders"', '"Orders So Far"') } });
    expect(await screen.findByText("Orders So Far")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset to file" }));
    expect(await screen.findByText("Total Orders")).toBeTruthy();
  });
});
