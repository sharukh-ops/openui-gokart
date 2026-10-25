import { describe, expect, it } from "vitest";
import { db } from "@/server/data/db";
import {
  computeOrdersByPayment,
  computeOrdersByStatus,
  computeProductsByCategory,
  computeSalesByStore,
  computeTopProducts,
} from "@/server/tools/breakdowns";

// Expected values were worked out from data/db.json with a separate plain-JS script.

describe("computeSalesByStore", () => {
  it("lists every store with its products, orders and revenue", () => {
    expect(computeSalesByStore(db).rows).toEqual([
      { store: "Happy Shop", status: "approved", products: 8, orders: 5, revenue: 307.4 },
      { store: "GreatStack", status: "approved", products: 4, orders: 2, revenue: 116 },
      { store: "Gadget Hub", status: "pending", products: 0, orders: 0, revenue: 0 },
    ]);
  });

  it("adds up to the dashboard totals", () => {
    const rows = computeSalesByStore(db).rows;
    expect(rows.reduce((sum, row) => sum + row.orders, 0)).toBe(7);
    expect(Math.round(rows.reduce((sum, row) => sum + row.revenue, 0) * 100) / 100).toBe(423.4);
  });
});

describe("computeOrdersByStatus", () => {
  it("groups orders by status in first-seen order", () => {
    expect(computeOrdersByStatus(db).rows).toEqual([
      { status: "DELIVERED", orders: 3, revenue: 208.8 },
      { status: "SHIPPED", orders: 1, revenue: 29 },
      { status: "PROCESSING", orders: 1, revenue: 29 },
      { status: "ORDER_PLACED", orders: 2, revenue: 156.6 },
    ]);
  });

  it("returns no rows when there are no orders", () => {
    expect(computeOrdersByStatus({ orders: [] }).rows).toEqual([]);
  });
});

describe("computeOrdersByPayment", () => {
  it("groups orders by payment method", () => {
    expect(computeOrdersByPayment(db).rows).toEqual([{ method: "COD", orders: 7, revenue: 423.4 }]);
  });
});

describe("computeProductsByCategory", () => {
  it("counts products and in-stock products per category", () => {
    const rows = computeProductsByCategory(db).rows;
    expect(rows).toHaveLength(10);
    expect(rows.find((row) => row.category === "Watch")).toEqual({ category: "Watch", products: 3, inStock: 3 });
    expect(rows.reduce((sum, row) => sum + row.products, 0)).toBe(12);
  });

  it("counts out-of-stock products only in products", () => {
    const products = [
      { id: "a", storeId: "s", name: "A", category: "Pen", inStock: true },
      { id: "b", storeId: "s", name: "B", category: "Pen", inStock: false },
    ];
    expect(computeProductsByCategory({ products }).rows).toEqual([{ category: "Pen", products: 2, inStock: 1 }]);
  });
});

describe("computeTopProducts", () => {
  it("puts the best seller first", () => {
    const rows = computeTopProducts(db).rows;
    expect(rows[0]).toEqual({ product: "Smart speaker gray", unitsSold: 4, revenue: 116 });
    expect(rows).toHaveLength(11);
    expect(rows.reduce((sum, row) => sum + row.unitsSold, 0)).toBe(16);
  });

  it("breaks ties by revenue, and falls back to the id for an unknown product", () => {
    const orders = [
      {
        id: "o",
        storeId: "s",
        total: 0,
        status: "SHIPPED",
        paymentMethod: "COD",
        createdAt: "2025-01-01T00:00:00.000Z",
        orderItems: [
          { productId: "cheap", quantity: 1, price: 5 },
          { productId: "gone", quantity: 1, price: 9 },
        ],
      },
    ];
    const products = [{ id: "cheap", storeId: "s", name: "Cheap", category: "Pen", inStock: true }];
    expect(computeTopProducts({ products, orders }).rows).toEqual([
      { product: "gone", unitsSold: 1, revenue: 9 },
      { product: "Cheap", unitsSold: 1, revenue: 5 },
    ]);
  });
});
