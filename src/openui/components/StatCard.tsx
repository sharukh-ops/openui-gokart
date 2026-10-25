import { defineComponent } from "@openuidev/react-lang";
import { CircleDollarSignIcon, ShoppingBasketIcon, StoreIcon, TagsIcon, type LucideIcon } from "lucide-react";
import { formatValue } from "../format";
import { StatCardSpec } from "../specs";

const ICONS = {
  products: ShoppingBasketIcon,
  revenue: CircleDollarSignIcon,
  orders: TagsIcon,
  stores: StoreIcon,
} satisfies Record<string, LucideIcon>;

/** One number box from GoCart's admin dashboard (same classes as app/admin/page.jsx). */
export const StatCard = defineComponent({
  ...StatCardSpec,
  component: ({ props }) => {
    const Icon = ICONS[props.icon];
    return (
      <div className="flex items-center gap-10 border border-slate-200 p-3 px-6 rounded-lg">
        <div className="flex flex-col gap-3 text-xs">
          <p>{props.title}</p>
          <b className="text-2xl font-medium text-slate-700">{formatValue(props.value, props.format)}</b>
        </div>
        <Icon size={50} className="w-11 h-11 p-2.5 text-slate-400 bg-slate-100 rounded-full" />
      </div>
    );
  },
});
