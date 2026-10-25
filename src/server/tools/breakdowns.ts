/**
 * Breakdown tools for the Ask button: GoCart's seed data grouped a few useful ways.
 *
 * Every tool returns `{ rows: [...] }` with only string and number fields, so a
 * recipe can pass `q.rows` straight to a chart. Money is rounded to cents here,
 * never in a recipe or a component.
 */
import { z } from "zod/v4";
import { db, type Db } from "../data/db";
import { defineTool } from "./registry";

const cents = (amount: number) => Math.round(amount * 100) / 100;

/** Adds one order's count and total to a running group. */
function addOrder<K>(groups: Map<K, { orders: number; revenue: number }>, key: K, total: number) {
  const group = groups.get(key) ?? { orders: 0, revenue: 0 };
  group.orders += 1;
  group.revenue += total;
  groups.set(key, group);
}

// ---- Sales by store ---------------------------------------------------------

export const SalesByStoreOutput = z.object({
  rows: z.array(
    z.object({
      store: z.string(),
      status: z.string(),
      products: z.number().int(),
      orders: z.number().int(),
      revenue: z.number(),
    }),
  ),
});

export function computeSalesByStore(data: Pick<Db, "stores" | "products" | "orders">): z.infer<typeof SalesByStoreOutput> {
  const sales = new Map<string, { orders: number; revenue: number }>();
  for (const order of data.orders) addOrder(sales, order.storeId, order.total);

  return {
    rows: data.stores.map((store) => ({
      store: store.name,
      status: store.status,
      products: data.products.filter((product) => product.storeId === store.id).length,
      orders: sales.get(store.id)?.orders ?? 0,
      revenue: cents(sales.get(store.id)?.revenue ?? 0),
    })),
  };
}

export const salesByStoreTool = defineTool({
  name: "get_sales_by_store",
  description:
    "One row per store (approved and pending): store name, approval status, number of products, " +
    "number of orders and revenue.",
  roles: ["admin"],
  input: z.object({}).strict(),
  output: SalesByStoreOutput,
  handler: () => computeSalesByStore(db),
});

// ---- Orders by status -------------------------------------------------------

export const OrdersByStatusOutput = z.object({
  rows: z.array(z.object({ status: z.string(), orders: z.number().int(), revenue: z.number() })),
});

export function computeOrdersByStatus(data: Pick<Db, "orders">): z.infer<typeof OrdersByStatusOutput> {
  const groups = new Map<string, { orders: number; revenue: number }>();
  for (const order of data.orders) addOrder(groups, order.status, order.total);
  return {
    rows: [...groups].map(([status, group]) => ({ status, orders: group.orders, revenue: cents(group.revenue) })),
  };
}

export const ordersByStatusTool = defineTool({
  name: "get_orders_by_status",
  description: "One row per order status (for example ORDER_PLACED, SHIPPED, DELIVERED): number of orders and revenue.",
  roles: ["admin"],
  input: z.object({}).strict(),
  output: OrdersByStatusOutput,
  handler: () => computeOrdersByStatus(db),
});

// ---- Orders by payment method -----------------------------------------------

export const OrdersByPaymentOutput = z.object({
  rows: z.array(z.object({ method: z.string(), orders: z.number().int(), revenue: z.number() })),
});

export function computeOrdersByPayment(data: Pick<Db, "orders">): z.infer<typeof OrdersByPaymentOutput> {
  const groups = new Map<string, { orders: number; revenue: number }>();
  for (const order of data.orders) addOrder(groups, order.paymentMethod, order.total);
  return {
    rows: [...groups].map(([method, group]) => ({ method, orders: group.orders, revenue: cents(group.revenue) })),
  };
}

export const ordersByPaymentTool = defineTool({
  name: "get_orders_by_payment_method",
  description: "One row per payment method (for example COD, STRIPE): number of orders and revenue.",
  roles: ["admin"],
  input: z.object({}).strict(),
  output: OrdersByPaymentOutput,
  handler: () => computeOrdersByPayment(db),
});

// ---- Products by category ---------------------------------------------------

export const ProductsByCategoryOutput = z.object({
  rows: z.array(z.object({ category: z.string(), products: z.number().int(), inStock: z.number().int() })),
});

export function computeProductsByCategory(data: Pick<Db, "products">): z.infer<typeof ProductsByCategoryOutput> {
  const groups = new Map<string, { products: number; inStock: number }>();
  for (const product of data.products) {
    const group = groups.get(product.category) ?? { products: 0, inStock: 0 };
    group.products += 1;
    if (product.inStock) group.inStock += 1;
    groups.set(product.category, group);
  }
  return { rows: [...groups].map(([category, group]) => ({ category, ...group })) };
}

export const productsByCategoryTool = defineTool({
  name: "get_products_by_category",
  description: "One row per product category: number of products and how many of them are in stock.",
  roles: ["admin"],
  input: z.object({}).strict(),
  output: ProductsByCategoryOutput,
  handler: () => computeProductsByCategory(db),
});

// ---- Top products -----------------------------------------------------------

export const TopProductsOutput = z.object({
  rows: z.array(z.object({ product: z.string(), unitsSold: z.number().int(), revenue: z.number() })),
});

/** Products that appear in orders, best seller first. Revenue is the line price times quantity. */
export function computeTopProducts(data: Pick<Db, "products" | "orders">): z.infer<typeof TopProductsOutput> {
  const sold = new Map<string, { unitsSold: number; revenue: number }>();
  for (const order of data.orders) {
    for (const item of order.orderItems) {
      const line = sold.get(item.productId) ?? { unitsSold: 0, revenue: 0 };
      line.unitsSold += item.quantity;
      line.revenue += item.quantity * item.price;
      sold.set(item.productId, line);
    }
  }
  const names = new Map(data.products.map((product) => [product.id, product.name]));
  return {
    rows: [...sold]
      .map(([id, line]) => ({ product: names.get(id) ?? id, unitsSold: line.unitsSold, revenue: cents(line.revenue) }))
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue),
  };
}

export const topProductsTool = defineTool({
  name: "get_top_products",
  description:
    "Products that have been ordered, best seller first: product name, units sold and revenue " +
    "(line price times quantity, before coupons).",
  roles: ["admin"],
  input: z.object({}).strict(),
  output: TopProductsOutput,
  handler: () => computeTopProducts(db),
});
