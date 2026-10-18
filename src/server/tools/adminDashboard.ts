/**
 * get_admin_dashboard: the numbers behind the admin dashboard.
 *
 * Ported from GoCart's `getAdminDashboard()` (web_open_ui/lib/mockApi.js) and the
 * grouping inside its `OrdersAreaChart`. The grouping moved here from the chart so
 * the layout only binds to ready data.
 */
import { z } from "zod/v4";
import { db, type Db } from "../data/db";
import { defineTool } from "./registry";

export const AdminDashboardOutput = z.object({
  products: z.number().int(),
  /** Sum of all order totals, rounded to cents. */
  revenue: z.number(),
  orders: z.number().int(),
  /** Approved stores only, matching GoCart. */
  stores: z.number().int(),
  ordersPerDay: z.array(z.object({ date: z.string(), orders: z.number().int() })),
});

export type AdminDashboard = z.infer<typeof AdminDashboardOutput>;

/**
 * Pure calculation, so it can be tested without the tool layer.
 *
 * KNOWN ISSUE kept on purpose for parity with GoCart: days are UTC dates
 * (`toISOString()`), so a late-evening order in India lands on the next day.
 * Days appear in the order they are first seen, as in GoCart's chart.
 */
export function computeAdminDashboard(data: Pick<Db, "products" | "stores" | "orders">): AdminDashboard {
  const perDay = new Map<string, number>();
  for (const order of data.orders) {
    const day = new Date(order.createdAt).toISOString().split("T")[0];
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const revenue = data.orders.reduce((sum, order) => sum + order.total, 0);

  return {
    products: data.products.length,
    revenue: Math.round(revenue * 100) / 100,
    orders: data.orders.length,
    stores: data.stores.filter((store) => store.status === "approved").length,
    ordersPerDay: [...perDay].map(([date, orders]) => ({ date, orders })),
  };
}

export const adminDashboardTool = defineTool({
  name: "get_admin_dashboard",
  description:
    "Platform totals for the admin dashboard: product count, revenue, order count, " +
    "approved store count, and the number of orders per day (UTC date).",
  roles: ["admin"],
  input: z.object({}).strict(),
  output: AdminDashboardOutput,
  handler: () => computeAdminDashboard(db),
});
