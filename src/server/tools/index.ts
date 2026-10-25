import { adminDashboardTool } from "./adminDashboard";
import {
  ordersByPaymentTool,
  ordersByStatusTool,
  productsByCategoryTool,
  salesByStoreTool,
  topProductsTool,
} from "./breakdowns";
import type { ToolDefinition } from "./registry";

const all = [
  adminDashboardTool,
  salesByStoreTool,
  ordersByStatusTool,
  ordersByPaymentTool,
  productsByCategoryTool,
  topProductsTool,
] as unknown as ToolDefinition[];

/** Every tool the app exposes, keyed by name. */
export const tools: Record<string, ToolDefinition> = Object.fromEntries(all.map((tool) => [tool.name, tool]));
