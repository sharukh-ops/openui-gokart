import { describe, expect, it } from "vitest";
import { db } from "@/server/data/db";

describe("seed data (db.json)", () => {
  it("has a current user who exists and is an admin", () => {
    const user = db.users.find((u) => u.id === db.currentUserId);
    expect(user?.isAdmin).toBe(true);
  });

  it("has orders with a finite total and a valid date", () => {
    expect(db.orders.length).toBeGreaterThan(0);
    for (const order of db.orders) {
      expect(Number.isFinite(order.total)).toBe(true);
      expect(Number.isNaN(new Date(order.createdAt).getTime())).toBe(false);
    }
  });

  it("has unique ids", () => {
    for (const list of [db.users, db.stores, db.products, db.orders]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("only links products and orders to stores that exist", () => {
    const storeIds = new Set(db.stores.map((s) => s.id));
    for (const p of db.products) expect(storeIds.has(p.storeId)).toBe(true);
    for (const o of db.orders) expect(storeIds.has(o.storeId)).toBe(true);
  });
});
