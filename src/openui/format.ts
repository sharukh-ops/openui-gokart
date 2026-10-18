/** Display formatting for bound values. Kept in code, never left to the layout or a model. */

export const CURRENCY_SYMBOL = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || "$";

export function formatValue(value: number | string, format: "number" | "currency" = "number"): string {
  if (format === "currency") {
    const amount = typeof value === "number" ? value : Number(value);
    return CURRENCY_SYMBOL + (Number.isFinite(amount) ? amount.toFixed(2) : String(value));
  }
  return String(value);
}
