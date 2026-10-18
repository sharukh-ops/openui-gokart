import { describe, expect, it } from "vitest";
import { db } from "@/server/data/db";
import { computeAdminDashboard } from "@/server/tools/adminDashboard";

describe("computeAdminDashboard", () => {
  it("matches GoCart's admin dashboard for the seed data", () => {
    // Values GoCart's getAdminDashboard() + OrdersAreaChart produce for data/db.json.
    expect(computeAdminDashboard(db)).toEqual({
      products: 12,
      revenue: 423.4,
      orders: 7,
      stores: 2,
      ordersPerDay: [
        { date: "2025-08-20", orders: 1 },
        { date: "2025-08-22", orders: 1 },
        { date: "2025-08-23", orders: 2 },
        { date: "2025-08-24", orders: 1 },
        { date: "2025-08-25", orders: 1 },
        { date: "2025-08-26", orders: 1 },
      ],
    });
  });

  it("returns zeros and no days for an empty store", () => {
    expect(computeAdminDashboard({ products: [], stores: [], orders: [] })).toEqual({
      products: 0,
      revenue: 0,
      orders: 0,
      stores: 0,
      ordersPerDay: [],
    });
  });

  it("counts approved stores only", () => {
    const stores = [
      { id: "a", userId: "u", name: "A", status: "approved", isActive: true },
      { id: "b", userId: "u", name: "B", status: "pending", isActive: false },
      { id: "c", userId: "u", name: "C", status: "rejected", isActive: false },
      { id: "d", userId: "u", name: "D", status: "approved", isActive: false },
    ];
    expect(computeAdminDashboard({ products: [], stores, orders: [] }).stores).toBe(2);
  });

  it("rounds revenue to cents without floating-point noise", () => {
    const orders = [
      { id: "1", storeId: "s", total: 0.1, createdAt: "2025-01-01T00:00:00.000Z" },
      { id: "2", storeId: "s", total: 0.2, createdAt: "2025-01-01T00:00:00.000Z" },
    ];
    expect(computeAdminDashboard({ products: [], stores: [], orders }).revenue).toBe(0.3);
  });

  it("groups by UTC date, the known GoCart quirk kept for parity", () => {
    // 20:00 UTC on 9 Oct is 01:30 on 10 Oct in India, but counts as 9 Oct.
    const orders = [{ id: "1", storeId: "s", total: 10, createdAt: "2026-10-09T20:00:00.000Z" }];
    expect(computeAdminDashboard({ products: [], stores: [], orders }).ordersPerDay).toEqual([
      { date: "2026-10-09", orders: 1 },
    ]);
  });
});
