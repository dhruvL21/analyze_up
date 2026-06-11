
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useData } from "@/context/data-context";
import { getMonthlySalesData } from "@/lib/chart-utils";
import { useMemo } from "react";

export function SalesChart() {
  const { transactions, products, isLoading } = useData();

  const data = useMemo(() => {
    if (isLoading || !transactions || !products) return [];
    return getMonthlySalesData(transactions, products);
  }, [transactions, products, isLoading]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-popover/70 p-2 shadow-sm backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col space-y-1">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Month
              </span>
              <span className="font-bold text-foreground">
                {label}
              </span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Revenue
              </span>
              <span className="font-bold text-primary">
                ₹{payload[0].value.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Expenses
              </span>
              <span className="font-bold text-destructive">
                ₹{payload[1]?.value.toLocaleString('en-IN') || 0}
              </span>
            </div>
          </div>
        </div>
      );
    }
  
    return null;
  };

  if (data.every(item => item.sales === 0 && item.expenses === 0)) {
     return (
       <div className="flex h-[300px] items-center justify-center border-2 border-dashed rounded-xl">
         <p className="text-sm text-muted-foreground">No financial data recorded yet.</p>
       </div>
     );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `₹${value}`}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--accent))", opacity: 0.5 }}
          content={<CustomTooltip />}
        />
        <Bar
          dataKey="sales"
          name="Revenue"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="expenses"
          name="Expenses"
          fill="hsl(var(--destructive))"
          radius={[4, 4, 0, 0]}
          opacity={0.8}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
