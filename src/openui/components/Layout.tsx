import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { AreaChart, BarChart } from "./Charts";
import { StatCard } from "./StatCard";

/** A wrapping row of StatCards (same spacing as GoCart's admin dashboard). */
export const StatRow = defineComponent({
  name: "StatRow",
  description: "A row of StatCards that wraps on small screens.",
  props: z.object({
    cards: z.array(StatCard.ref).describe("The StatCards to show"),
  }),
  component: ({ props, renderNode }) => (
    <div className="flex flex-wrap gap-5 my-10 mt-4">{renderNode(props.cards)}</div>
  ),
});

/** Page root: the two-tone heading, then its sections in order. */
export const Dashboard = defineComponent({
  name: "Dashboard",
  description: "The page root. A heading in two tones followed by sections.",
  props: z.object({
    muted: z.string().describe("Grey first word of the heading, e.g. 'Admin'"),
    title: z.string().describe("Dark second word of the heading, e.g. 'Dashboard'"),
    sections: z.array(z.union([StatRow.ref, AreaChart.ref, BarChart.ref])).describe("Sections in display order"),
  }),
  component: ({ props, renderNode }) => (
    <div className="text-slate-500">
      <h1 className="text-2xl">
        {props.muted} <span className="text-slate-800 font-medium">{props.title}</span>
      </h1>
      {renderNode(props.sections)}
    </div>
  ),
});
