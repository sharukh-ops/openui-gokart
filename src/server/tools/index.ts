import { adminDashboardTool } from "./adminDashboard";
import type { ToolDefinition } from "./registry";

/** Every tool the app exposes, keyed by name. */
export const tools: Record<string, ToolDefinition> = {
  [adminDashboardTool.name]: adminDashboardTool as unknown as ToolDefinition,
};
