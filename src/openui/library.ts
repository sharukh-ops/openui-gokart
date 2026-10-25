/**
 * The components a GoCart page recipe may use. The Renderer draws only these.
 * Names, descriptions and props come from specs.ts, which the server shares.
 * Docs: https://openui.com/docs/api-reference/react-lang
 */
import { createLibrary } from "@openuidev/react-lang";
import { AreaChart, BarChart, PieChart } from "./components/Charts";
import { Dashboard, StatRow } from "./components/Layout";
import { StatCard } from "./components/StatCard";
import { LIBRARY } from "./specs";

export const gocartLibrary = createLibrary({
  ...LIBRARY,
  components: [Dashboard, StatRow, StatCard, AreaChart, BarChart, PieChart],
});
