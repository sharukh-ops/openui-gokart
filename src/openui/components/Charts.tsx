import { defineComponent } from "@openuidev/react-lang";
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod/v4";

/**
 * Same props for both chart types, so a recipe can swap one for the other.
 * A function, not a shared object: defineComponent tags the schema it is given
 * with the component's name, so one shared schema would end up named after
 * whichever chart was defined last and the other would vanish from the library.
 */
const chartProps = () => z.object({
  muted: z.string().describe("Grey first part of the heading, e.g. 'Orders /'"),
  title: z.string().describe("Dark second part of the heading, e.g. 'Day'"),
  data: z
    .array(z.record(z.string(), z.union([z.string(), z.number()])))
    .describe("Rows to plot, usually bound to a Query field"),
  xKey: z.string().describe("Field in each row for the horizontal axis"),
  yKey: z.string().describe("Field in each row for the value"),
  yLabel: z.string().optional().describe("Vertical axis label"),
});

type ChartProps = z.infer<ReturnType<typeof chartProps>>;

/** Frame and heading copied from GoCart's components/OrdersAreaChart.jsx. */
function ChartFrame({ muted, title, children }: { muted: string; title: string; children: React.ReactElement }) {
  return (
    <div className="w-full max-w-4xl h-[300px] text-xs">
      <h3 className="text-lg font-medium text-slate-800 mb-4 pt-2 text-right">
        <span className="text-slate-500">{muted}</span> {title}
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function yAxis(props: ChartProps) {
  return (
    <YAxis
      allowDecimals={false}
      label={props.yLabel ? { value: props.yLabel, angle: -90, position: "insideLeft" } : undefined}
    />
  );
}

export const AreaChart = defineComponent({
  name: "AreaChart",
  description: "An area chart of one value over a sequence such as days.",
  props: chartProps(),
  component: ({ props }) => (
    <ChartFrame muted={props.muted} title={props.title}>
      <RechartsAreaChart data={props.data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={props.xKey} />
        {yAxis(props)}
        <Tooltip />
        <Area type="monotone" dataKey={props.yKey} stroke="#4f46e5" fill="#8884d8" strokeWidth={2} />
      </RechartsAreaChart>
    </ChartFrame>
  ),
});

export const BarChart = defineComponent({
  name: "BarChart",
  description: "A bar chart of one value per category or day.",
  props: chartProps(),
  component: ({ props }) => (
    <ChartFrame muted={props.muted} title={props.title}>
      <RechartsBarChart data={props.data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={props.xKey} />
        {yAxis(props)}
        <Tooltip />
        <Bar dataKey={props.yKey} fill="#8884d8" />
      </RechartsBarChart>
    </ChartFrame>
  ),
});
