/** Display formatting for bound values. Kept in code, never left to the layout or a model. */

export const CURRENCY_SYMBOL = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "$";

export function formatValue(value: number | string | undefined, format: "number" | "currency" = "number"): string {
  // Undefined for one render when a swapped-in recipe reuses a Query name (see rowsOf in Charts.tsx).
  if (value === undefined || value === null) return "–";
  if (format === "currency") {
    const amount = typeof value === "number" ? value : Number(value);
    return CURRENCY_SYMBOL + (Number.isFinite(amount) ? amount.toFixed(2) : String(value));
  }
  return String(value);
}
