"use client";

import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { useData } from "@/context/data-context";
import { getInventoryValueData } from "@/lib/chart-utils";
import { useMemo } from "react";

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function InventoryValueChart() {
  const { products, categories, isLoading } = useData();

  const data = useMemo(() => {
    if (isLoading || !products || !categories) return [];
    const aggregated = getInventoryValueData(products, categories);
    // Filter out rows where value is 0 to keep the pie clean
    return aggregated.filter(item => item.sales > 0);
  }, [products, categories, isLoading]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-lg border bg-popover/70 p-2 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col space-y-1">
             <span className="text-xs font-semibold text-foreground">{item.name}</span>
             <span className="text-[0.70rem] uppercase text-muted-foreground">Inventory Value</span>
             <span className="font-bold text-foreground">₹{item.sales.toLocaleString('en-IN')}</span>
          </div>
        </div>
      );
    }
  
    return null;
  };

  if (data.length === 0) {
     return (
       <div className="flex h-[300px] items-center justify-center border-2 border-dashed rounded-xl">
         <p className="text-sm text-muted-foreground">No inventory value to display.</p>
       </div>
     );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={5}
          dataKey="sales"
          nameKey="name"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="bottom" height={36}/>
      </PieChart>
    </ResponsiveContainer>
  );
}
