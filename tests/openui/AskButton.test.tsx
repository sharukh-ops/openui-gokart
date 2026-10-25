import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AskButton from "@/openui/AskButton";
import PageRenderer from "@/openui/PageRenderer";
import { DASHBOARD, jsonResponse, RECIPE } from "../helpers";

const SALES = `root = Dashboard("Revenue by", "Store", [chart])
q = Query("get_sales_by_store", {}, {"rows": []})
chart = BarChart("Revenue /", "Store", q.rows, "store", "revenue")`;

function stubAsk(respond: () => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe("/api/ask");
    expect(JSON.parse(String(init?.body))).toHaveProperty("question");
    return respond();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function openAndAsk(text: string) {
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /show me/i }));
}

describe("AskButton", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens a panel, sends the question and hands back the recipe", async () => {
    const fetchMock = stubAsk(() => jsonResponse({ source: SALES }));
    const onRecipe = vi.fn();
    render(<AskButton onRecipe={onRecipe} />);
    expect(screen.queryByRole("dialog")).toBeNull();

    openAndAsk("  revenue by store ");
    await waitFor(() => expect(onRecipe).toHaveBeenCalledWith(SALES, "revenue by store"));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ question: "revenue by store" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks straight away from an example", async () => {
    stubAsk(() => jsonResponse({ source: SALES }));
    const onRecipe = vi.fn();
    render(<AskButton onRecipe={onRecipe} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(screen.getByRole("button", { name: "Orders by status as a pie chart" }));
    await waitFor(() => expect(onRecipe).toHaveBeenCalledWith(SALES, "Orders by status as a pie chart"));
  });

  it("sends on Enter", async () => {
    stubAsk(() => jsonResponse({ source: SALES }));
    const onRecipe = vi.fn();
    render(<AskButton onRecipe={onRecipe} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const input = screen.getByLabelText("Your question");
    fireEvent.change(input, { target: { value: "top products" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onRecipe).toHaveBeenCalled());
  });

  it("shows the server's message and keeps the panel open on failure", async () => {
    stubAsk(() => jsonResponse({ error: { message: "GROQ_API_KEY is not set." } }, 503));
    const onRecipe = vi.fn();
    render(<AskButton onRecipe={onRecipe} />);
    openAndAsk("revenue by store");
    expect((await screen.findByRole("alert")).textContent).toContain("GROQ_API_KEY is not set.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onRecipe).not.toHaveBeenCalled();
  });

  it("falls back to the HTTP status when there is no message", async () => {
    stubAsk(() => new Response("", { status: 500 }));
    render(<AskButton onRecipe={vi.fn()} />);
    openAndAsk("revenue by store");
    expect((await screen.findByRole("alert")).textContent).toContain("HTTP 500");
  });

  it("does not send a question that is too short, and closes with Escape", () => {
    const fetchMock = stubAsk(() => jsonResponse({ source: SALES }));
    render(<AskButton onRecipe={vi.fn()} />);
    openAndAsk("hi");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PageRenderer with the Ask button", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("replaces the dashboard with the answer, and goes back", async () => {
    const sales = { rows: [{ store: "Happy Shop", status: "approved", products: 8, orders: 5, revenue: 307.4 }] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/layouts/")) return jsonResponse({ source: RECIPE });
        if (url === "/api/ask") return jsonResponse({ source: SALES });
        const { name } = JSON.parse(String(init?.body)) as { name: string };
        return jsonResponse({ result: name === "get_sales_by_store" ? sales : DASHBOARD });
      }),
    );

    render(<PageRenderer layout="admin-dashboard" />);
    expect(await screen.findByText("$423.40")).toBeTruthy();

    openAndAsk("revenue by store");
    expect(await screen.findByText(/Showing your request/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("$423.40")).toBeNull());
    expect(screen.getByText("Revenue /")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
    expect(await screen.findByText("$423.40")).toBeTruthy();
    expect(screen.queryByText(/Showing your request/)).toBeNull();
  });
});
