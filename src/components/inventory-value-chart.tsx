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
import { Sparkles, Coins, AlertTriangle, ShieldCheck, Lightbulb } from "lucide-react";

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function InventoryValueChart() {
  const { products, categories, isLoading, businessProfile } = useData();
  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  const data = useMemo(() => {
    if (isLoading || !products || !categories) return [];
    const aggregated = getInventoryValueData(products, categories);
    // Filter out rows where value is 0 to keep the pie clean
    return aggregated.filter(item => item.sales > 0);
  }, [products, categories, isLoading]);

  const insights = useMemo(() => {
    if (!products || products.length === 0 || data.length === 0) return null;

    const totalValue = data.reduce((sum, item) => sum + item.sales, 0);
    const sorted = [...data].sort((a, b) => b.sales - a.sales);
    const topCat = sorted[0];
    const topShare = totalValue > 0 && topCat ? Math.round((topCat.sales / totalValue) * 100) : 0;

    const lowStockItems = products.filter(
      p => (Number(p.stock) || 0) > 0 && (Number(p.stock) || 0) <= (Number(p.minStock) || 10)
    );
    const outOfStockItems = products.filter(p => (Number(p.stock) || 0) === 0);

    return {
      totalValue,
      topCat,
      topShare,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
    };
  }, [products, data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-lg border bg-popover/70 p-2 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col space-y-1">
            <span className="text-xs font-semibold text-foreground">{item.name}</span>
            <span className="text-[0.70rem] uppercase text-muted-foreground">Inventory Value</span>
            <span className="font-bold text-foreground">{currencySymbol}{item.sales.toLocaleString('en-IN')}</span>
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
    <div className="space-y-4">
      {/* Donut Chart */}
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={88}
            paddingAngle={4}
            dataKey="sales"
            nameKey="name"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" height={32} />
        </PieChart>
      </ResponsiveContainer>

      {/* Short & Highlighted AI Suggestions & Information */}
      {insights && (
        <div className="pt-3 border-t border-border/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Key Info & AI Suggestions
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25">
              Live Insights
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {/* 1. Capital Allocation & Concentration */}
            <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:bg-secondary/40 transition-colors">
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="p-1 rounded-md bg-amber-500/15 text-amber-400">
                    <Coins className="w-3 h-3" />
                  </span>
                  Capital Allocation
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                  {insights.topShare}% Concentration
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                <strong className="text-foreground">{insights.topCat?.name}</strong> accounts for{' '}
                <strong className="text-primary font-bold">
                  {currencySymbol}{insights.topCat?.sales?.toLocaleString('en-IN')}
                </strong>
                . {insights.topShare >= 60
                  ? 'High single-category exposure. Monitor sales velocity closely to avoid capital lockup.'
                  : 'Balanced capital distribution across active product lines.'}
              </p>
            </div>

            {/* 2. Stock Buffer & Availability Risk */}
            <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:bg-secondary/40 transition-colors">
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className={`p-1 rounded-md ${
                    insights.outOfStockCount > 0 || insights.lowStockCount > 0
                      ? 'bg-rose-500/15 text-rose-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {insights.outOfStockCount > 0 || insights.lowStockCount > 0 ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <ShieldCheck className="w-3 h-3" />
                    )}
                  </span>
                  Runway & Availability
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  insights.outOfStockCount > 0 || insights.lowStockCount > 0
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {insights.outOfStockCount > 0
                    ? `${insights.outOfStockCount} Stockout`
                    : insights.lowStockCount > 0
                    ? `${insights.lowStockCount} Low Buffer`
                    : 'Healthy Buffer'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                {insights.outOfStockCount > 0
                  ? `${insights.outOfStockCount} SKU(s) currently at zero stock. Fast-track replenishment to protect customer demand.`
                  : insights.lowStockCount > 0
                  ? `${insights.lowStockCount} SKU(s) near reorder threshold. Prepare supplier POs early to avoid delivery lag.`
                  : 'All tracked inventory categories have sufficient runway buffer for upcoming fulfillment.'}
              </p>
            </div>

            {/* 3. Actionable Advice */}
            <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40 hover:bg-secondary/40 transition-colors">
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="p-1 rounded-md bg-primary/15 text-primary">
                    <Lightbulb className="w-3 h-3" />
                  </span>
                  Actionable Advice
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  AI Recommendation
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
                {insights.topShare >= 60
                  ? 'Bundle top-value lines with complementary items to accelerate cash conversion and optimize working capital.'
                  : 'Review sales velocity trends across categories weekly to proactively reallocate procurement budgets.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
