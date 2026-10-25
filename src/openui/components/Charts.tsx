import { defineComponent } from "@openuidev/react-lang";
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AreaChartSpec, BarChartSpec, PieChartSpec, type ChartProps } from "../specs";

/**
 * The rows, or none yet. When the Ask button swaps recipes and the new one reuses
 * a Query name (say `q`), OpenUI briefly keeps the old result, so `q.rows` can be
 * undefined for one render until the new data arrives.
 */
function rowsOf(data: ChartProps["data"] | undefined): ChartProps["data"] {
  return Array.isArray(data) ? data : [];
}

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
  ...AreaChartSpec,
  component: ({ props }) => (
    <ChartFrame muted={props.muted} title={props.title}>
      <RechartsAreaChart data={rowsOf(props.data)}>
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
  ...BarChartSpec,
  component: ({ props }) => (
    <ChartFrame muted={props.muted} title={props.title}>
      <RechartsBarChart data={rowsOf(props.data)}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={props.xKey} />
        {yAxis(props)}
        <Tooltip />
        <Bar dataKey={props.yKey} fill="#8884d8" />
      </RechartsBarChart>
    </ChartFrame>
  ),
});

/** Slice colours, starting from the indigo and lavender the other charts use. */
const PIE_COLORS = ["#4f46e5", "#8884d8", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#64748b"];

export const PieChart = defineComponent({
  ...PieChartSpec,
  component: ({ props }) => (
    <ChartFrame muted={props.muted} title={props.title}>
      <RechartsPieChart>
        <Pie
          data={rowsOf(props.data).map((row, i) => ({ ...row, fill: PIE_COLORS[i % PIE_COLORS.length] }))}
          dataKey={props.valueKey}
          nameKey={props.nameKey}
          outerRadius="80%"
          label
        />
        <Tooltip />
        <Legend />
      </RechartsPieChart>
    </ChartFrame>
  ),
});
