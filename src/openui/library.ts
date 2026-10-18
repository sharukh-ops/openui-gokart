/**
 * The components a GoCart page recipe may use. The Renderer draws only these,
 * and in phase two the same library generates the model's instructions.
 * Docs: https://openui.com/docs/api-reference/react-lang
 */
import { createLibrary } from "@openuidev/react-lang";
import { AreaChart, BarChart } from "./components/Charts";
import { Dashboard, StatRow } from "./components/Layout";
import { StatCard } from "./components/StatCard";

export const gocartLibrary = createLibrary({
  id: "gocart-admin@1",
  root: "Dashboard",
  components: [Dashboard, StatRow, StatCard, AreaChart, BarChart],
});
