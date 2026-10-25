import { defineComponent } from "@openuidev/react-lang";
import { DashboardSpec, StatRowSpec } from "../specs";

/** A wrapping row of StatCards (same spacing as GoCart's admin dashboard). */
export const StatRow = defineComponent({
  ...StatRowSpec,
  component: ({ props, renderNode }) => (
    <div className="flex flex-wrap gap-5 my-10 mt-4">{renderNode(props.cards)}</div>
  ),
});

/** Page root: the two-tone heading, then its sections in order. */
export const Dashboard = defineComponent({
  ...DashboardSpec,
  component: ({ props, renderNode }) => (
    <div className="text-slate-500">
      <h1 className="text-2xl">
        {props.muted} <span className="text-slate-800 font-medium">{props.title}</span>
      </h1>
      {renderNode(props.sections)}
    </div>
  ),
});
