import { afterEach, describe, expect, it, vi } from "vitest";
import { formatValue } from "@/openui/format";

describe("formatValue", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("shows plain numbers and strings as they are", () => {
    expect(formatValue(12)).toBe("12");
    expect(formatValue(0)).toBe("0");
    expect(formatValue("n/a")).toBe("n/a");
    expect(formatValue(7, "number")).toBe("7");
  });

  it("formats currency with the symbol and two decimals", () => {
    expect(formatValue(423.4, "currency")).toBe("$423.40");
    expect(formatValue(0, "currency")).toBe("$0.00");
    expect(formatValue(1234.567, "currency")).toBe("$1234.57");
  });

  it("formats a numeric string as currency", () => {
    expect(formatValue("423.4", "currency")).toBe("$423.40");
  });

  it("does not print NaN for a non-numeric currency value", () => {
    expect(formatValue("unknown", "currency")).toBe("$unknown");
  });

  it("uses NEXT_PUBLIC_CURRENCY_SYMBOL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_CURRENCY_SYMBOL", "₹");
    const fresh = await import("@/openui/format");
    expect(fresh.formatValue(5, "currency")).toBe("₹5.00");
  });
});
