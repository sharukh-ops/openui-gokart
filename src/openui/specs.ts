/**
 * What each recipe component is called, what it is for and what props it takes,
 * with no React in sight.
 *
 * The browser's library (library.ts) adds the React renderers. The server
 * (src/server/ai/library.ts) builds the same library from these specs to write
 * the AI prompt and check recipes: a route handler cannot import
 * @openuidev/react-lang, because it calls React's createContext at import time.
 *
 * Each spec gets its own schema object. defineComponent tags the schema with the
 * component's name, so a shared schema ends up named after whichever component
 * was defined last and the other one vanishes from the library.
 */
import { z } from "zod/v4";

const rows = () =>
  z.array(z.record(z.string(), z.union([z.string(), z.number()]))).describe("Rows to plot, usually bound to a Query field");

export const StatCardSpec = {
  name: "StatCard",
  description: "A labelled number box with an icon. Use for one headline figure such as a total.",
  props: z.object({
    title: z.string().describe("Label shown above the number"),
    value: z.union([z.number(), z.string()]).describe("The number, usually bound to a Query field"),
    icon: z.enum(["products", "revenue", "orders", "stores"]).describe("Which icon to show"),
    format: z.enum(["number", "currency"]).optional().describe("currency adds the symbol and 2 decimals"),
  }),
};

export const StatRowSpec = {
  name: "StatRow",
  description: "A row of StatCards that wraps on small screens.",
  props: z.object({
    cards: z.array(StatCardSpec.props).describe("The StatCards to show"),
  }),
};

/** Same props for AreaChart and BarChart, so a recipe can swap one for the other. */
const chartProps = () =>
  z.object({
    muted: z.string().describe("Grey first part of the heading, e.g. 'Orders /'"),
    title: z.string().describe("Dark second part of the heading, e.g. 'Day'"),
    data: rows(),
    xKey: z.string().describe("Field in each row for the horizontal axis"),
    yKey: z.string().describe("Field in each row for the value"),
    yLabel: z.string().optional().describe("Vertical axis label"),
  });

export type ChartProps = z.infer<ReturnType<typeof chartProps>>;

export const AreaChartSpec = {
  name: "AreaChart",
  description: "An area chart of one value over a sequence such as days.",
  props: chartProps(),
};

export const BarChartSpec = {
  name: "BarChart",
  description: "A bar chart of one value per category or day.",
  props: chartProps(),
};

export const PieChartSpec = {
  name: "PieChart",
  description: "A pie chart showing how a total splits across a few categories (best with 2 to 8 slices).",
  props: z.object({
    muted: z.string().describe("Grey first part of the heading, e.g. 'Orders by'"),
    title: z.string().describe("Dark second part of the heading, e.g. 'Status'"),
    data: rows(),
    nameKey: z.string().describe("Field in each row that names the slice"),
    valueKey: z.string().describe("Field in each row for the slice size"),
  }),
};

export const DashboardSpec = {
  name: "Dashboard",
  description: "The page root. A heading in two tones followed by sections.",
  props: z.object({
    muted: z.string().describe("Grey first word of the heading, e.g. 'Admin'"),
    title: z.string().describe("Dark second word of the heading, e.g. 'Dashboard'"),
    sections: z
      .array(z.union([StatRowSpec.props, AreaChartSpec.props, BarChartSpec.props, PieChartSpec.props]))
      .describe("Sections in display order"),
  }),
};

export const LIBRARY = {
  id: "gocart-admin@1",
  root: DashboardSpec.name,
} as const;
