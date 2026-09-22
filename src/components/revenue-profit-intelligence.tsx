'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/data-context';
import {
  Trophy,
  TrendingUp,
  AlertTriangle,
  Coins,
  Sparkles,
  Zap,
  Layers,
  HelpCircle,
} from 'lucide-react';

export function RevenueProfitIntelligence() {
  const { products = [], transactions = [], businessProfile } = useData();
  const [activeTab, setActiveTab] = useState<'revenue' | 'profit' | 'performance'>('profit');

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  // Calculate Product Financial Metrics with fast O(N + M) pre-indexed lookup
  const productMetrics = React.useMemo(() => {
    const salesByProduct = new Map<string, { qty: number; revenue: number }>();
    transactions.forEach((t: any) => {
      if (t.type === 'Sale' || t.type === 'sale') {
        const qty = Number(t.quantity ?? t.units_sold ?? t.qty ?? t.unitsSold ?? 0);
        const price = Number(t.price ?? t.selling_price ?? t.sellingPrice ?? t.unitPrice ?? 0);
        const rev = Number(t.totalRevenue ?? t.revenue ?? t.amount ?? (qty * price));
        const keys = [t.productId, t.product_id, t.sku, t.productName, t.product_name, t.name]
          .filter(Boolean)
          .map((k) => String(k).trim().toUpperCase()) as string[];
        keys.forEach((k) => {
          const existing = salesByProduct.get(k) || { qty: 0, revenue: 0 };
          existing.qty += qty;
          existing.revenue += rev;
          salesByProduct.set(k, existing);
        });
      }
    });

    return products.map((p: any) => {
      const lookupKeys = [p.id, p.sku, p.name, p.productName, p.title]
        .filter(Boolean)
        .map((k) => String(k).trim().toUpperCase());
      let saleInfo = { qty: 0, revenue: 0 };
      for (const k of lookupKeys) {
        if (salesByProduct.has(k)) {
          saleInfo = salesByProduct.get(k)!;
          break;
        }
      }
      const qtySold = saleInfo.qty;
      const revenue = saleInfo.revenue;

      const unitCost = p.costPrice || p.price * 0.6;
      const totalCost = qtySold * unitCost;
      const profit = revenue - totalCost;

      // Unit potential profit
      const unitProfit = p.price - unitCost;
      const unitMargin = p.price > 0 ? (unitProfit / p.price) * 100 : 0;
      const unitRoi = unitCost > 0 ? (unitProfit / unitCost) * 100 : 0;

      // Margin calculation
      const rawMargin = revenue > 0 ? (profit / revenue) * 100 : unitMargin;
      const margin = isNaN(rawMargin) ? 0 : rawMargin;

      // ROI calculation: Net Profit / Tied Inventory Capital Investment * 100
      const inventoryInvestment = (p.stock || 0) * unitCost;
      const rawRoi = inventoryInvestment > 0 && profit > 0 ? (profit / inventoryInvestment) * 100 : unitRoi;
      const roi = isNaN(rawRoi) ? 0 : rawRoi;

      // Inventory Turnover
      const turnover = (p.stock || 0) > 0 ? qtySold / p.stock : 0;

      return {
        product: p,
        qtySold,
        revenue,
        cost: totalCost,
        unitCost,
        unitProfit,
        unitMargin,
        unitRoi,
        profit,
        margin,
        inventoryInvestment,
        roi,
        turnover,
        asp: qtySold > 0 ? revenue / qtySold : p.price,
      };
    });
  }, [products, transactions]);

  // Overall Business Totals
  const totalBusinessProfit = productMetrics.reduce((sum, item) => sum + (item.profit > 0 ? item.profit : 0), 0);
  const totalBusinessRevenue = productMetrics.reduce((sum, item) => sum + item.revenue, 0);
  const hasActualSales = transactions.some((t) => t.type === 'Sale');

  // 1. CARD 1: Highest Profit Product
  const sortedByProfit = [...productMetrics].sort((a, b) => {
    if (hasActualSales) return b.profit - a.profit;
    return b.unitProfit - a.unitProfit;
  });
  const highestProfitItem = sortedByProfit[0];

  // 2. CARD 2: Highest Revenue Product
  const sortedByRevenue = [...productMetrics].sort((a, b) => {
    if (hasActualSales) return b.revenue - a.revenue;
    return b.product.price - a.product.price;
  });
  const highestRevenueItem = sortedByRevenue[0];

  // 3. CARD 3: Lowest Margin Product
  const sortedByMargin = [...productMetrics].sort((a, b) => a.margin - b.margin);
  const lowestMarginItem = sortedByMargin[0];

  // 4. CARD 4: Highest ROI Product
  const sortedByRoi = [...productMetrics].sort((a, b) => {
    if (hasActualSales && a.profit > 0) return b.roi - a.roi;
    return b.roi - a.roi;
  });
  const highestRoiItem = sortedByRoi[0];

  const hasNoProducts = products.length === 0;

  return (
    <Card className="ios-glass rounded-3xl border-border/50 p-5 shadow-xl space-y-4 h-full flex flex-col justify-between">
      <div>
        {/* Header with 3 Tabs */}
        <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-bold text-foreground truncate">Revenue &amp; Profit Intelligence</CardTitle>
                <CardDescription className="text-xs text-muted-foreground truncate">Financial insights, margin expansion &amp; product ROI</CardDescription>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border/40 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button
              size="sm"
              variant={activeTab === 'revenue' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('revenue')}
              className="rounded-lg text-xs h-7 px-3 font-medium shrink-0"
            >
              Revenue
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'profit' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('profit')}
              className="rounded-lg text-xs h-7 px-3 font-medium shrink-0"
            >
              Profit
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'performance' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('performance')}
              className="rounded-lg text-xs h-7 px-3 font-medium shrink-0"
            >
              Performance
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 pt-3 space-y-4">
          {hasNoProducts ? (
            <div className="p-8 text-center text-muted-foreground space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-muted-foreground/60" />
              <p className="font-semibold text-foreground text-sm">No product data available in your app yet.</p>
              <p className="text-xs text-muted-foreground">Add products or import a CSV/Excel file to populate your financial intelligence board.</p>
            </div>
          ) : activeTab === 'profit' ? (
            /* PROFIT TAB: 4 FINANCIAL INTELLIGENCE CARDS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CARD 1: Highest Profit Product */}
              <div className="p-4 rounded-2xl bg-secondary/40 border border-emerald-500/30 space-y-3 flex flex-col justify-between shadow-xs">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Highest Profit Product
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium px-2 py-0.5">
                      {hasActualSales && highestProfitItem.qtySold > 0 ? 'Top Performer' : 'Highest Potential'}
                    </Badge>
                  </div>

                  {highestProfitItem && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-foreground text-sm truncate">
                        {highestProfitItem.product.name}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            {hasActualSales ? 'Total Revenue' : 'Selling Price'}
                          </span>
                          <span className="font-bold text-foreground text-sm block">
                            {currencySymbol}{Math.round(hasActualSales && highestProfitItem.revenue > 0 ? highestProfitItem.revenue : highestProfitItem.product.price).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            {hasActualSales ? 'Net Profit' : 'Unit Profit'}
                          </span>
                          <span className="font-bold text-emerald-400 text-sm block">
                            {currencySymbol}{Math.round(hasActualSales && highestProfitItem.profit > 0 ? highestProfitItem.profit : highestProfitItem.unitProfit).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Profit Margin
                          </span>
                          <span className="font-bold text-emerald-400 text-sm block">
                            {highestProfitItem.margin.toFixed(0)}%
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Units Sold / Stock
                          </span>
                          <span className="font-bold text-foreground text-xs block">
                            {highestProfitItem.qtySold} sold ({highestProfitItem.product.stock} in stock)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground/90 flex items-start gap-2 leading-relaxed">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {hasActualSales && highestProfitItem.profit > 0
                      ? `Contributes ${totalBusinessProfit > 0 ? Math.round((highestProfitItem.profit / totalBusinessProfit) * 100) : 0}% of total profit with a healthy ${highestProfitItem.margin.toFixed(0)}% margin.`
                      : `Yields the highest unit profit (${currencySymbol}${Math.round(highestProfitItem.unitProfit)}) with a strong ${highestProfitItem.margin.toFixed(0)}% margin in your catalog.`}
                  </span>
                </div>
              </div>

              {/* CARD 2: Highest Revenue Product */}
              <div className="p-4 rounded-2xl bg-secondary/40 border border-primary/30 space-y-3 flex flex-col justify-between shadow-xs">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" /> Highest Revenue Product
                    </span>
                    <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs font-medium px-2 py-0.5">
                      {hasActualSales && highestRevenueItem.revenue > 0 ? 'Best Seller' : 'Catalog Leader'}
                    </Badge>
                  </div>

                  {highestRevenueItem && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-foreground text-sm truncate">
                        {highestRevenueItem.product.name}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Revenue
                          </span>
                          <span className="font-bold text-primary text-sm block">
                            {currencySymbol}{Math.round(hasActualSales && highestRevenueItem.revenue > 0 ? highestRevenueItem.revenue : highestRevenueItem.product.price).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Units Sold
                          </span>
                          <span className="font-bold text-foreground text-xs block">
                            {highestRevenueItem.qtySold} units
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Avg Selling Price
                          </span>
                          <span className="font-bold text-foreground text-sm block">
                            {currencySymbol}{Math.round(highestRevenueItem.asp)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Stock Level
                          </span>
                          <span className="font-bold text-foreground text-xs block">
                            {highestRevenueItem.product.stock} units
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground/90 flex items-start gap-2 leading-relaxed">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    {hasActualSales && highestRevenueItem.revenue > 0
                      ? `Generates highest sales revenue (${currencySymbol}${Math.round(highestRevenueItem.revenue).toLocaleString('en-IN')}). Monitor margin to maximize cash flow.`
                      : `Highest priced item (${currencySymbol}${highestRevenueItem.product.price}) in your imported catalog.`}
                  </span>
                </div>
              </div>

              {/* CARD 3: Lowest Margin Product */}
              <div className="p-4 rounded-2xl bg-secondary/40 border border-rose-500/30 space-y-3 flex flex-col justify-between shadow-xs">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Lowest Margin Product
                    </span>
                    <Badge variant="outline" className="text-rose-400 border-rose-500/30 text-xs font-medium px-2 py-0.5 whitespace-nowrap shrink-0">
                      {lowestMarginItem && lowestMarginItem.margin < 0 ? 'Loss Making' : 'Needs Attention'}
                    </Badge>
                  </div>

                  {lowestMarginItem && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-foreground text-sm truncate">
                        {lowestMarginItem.product.name}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Margin %
                          </span>
                          <span className="font-bold text-rose-400 text-sm block">
                            {lowestMarginItem.margin < -100 ? '-100%' : `${lowestMarginItem.margin.toFixed(0)}%`}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Selling / Cost
                          </span>
                          <span className="font-bold text-foreground text-xs block">
                            {currencySymbol}{lowestMarginItem.product.price} / {currencySymbol}{Math.round(lowestMarginItem.unitCost)}
                          </span>
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
                        Action: Increase price by 5-10% or negotiate supplier cost.
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-foreground/90 flex items-start gap-2 leading-relaxed">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    Operating below target margins ({lowestMarginItem && lowestMarginItem.margin < -100 ? '-100%' : `${lowestMarginItem?.margin.toFixed(0)}%`}). Consider price tweaks or supplier negotiations.
                  </span>
                </div>
              </div>

              {/* CARD 4: Highest ROI Product */}
              <div className="p-4 rounded-2xl bg-secondary/40 border border-amber-500/30 space-y-3 flex flex-col justify-between shadow-xs">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Highest ROI Product
                    </span>
                    <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs font-medium px-2 py-0.5">
                      High ROI
                    </Badge>
                  </div>

                  {highestRoiItem && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-foreground text-sm truncate">
                        {highestRoiItem.product.name}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Return on Investment
                          </span>
                          <span className="font-bold text-amber-400 text-sm block">
                            {highestRoiItem.roi.toFixed(0)}% ROI
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Tied Capital
                          </span>
                          <span className="font-bold text-foreground text-sm block">
                            {currencySymbol}{Math.round(highestRoiItem.inventoryInvestment).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Unit Profit
                          </span>
                          <span className="font-bold text-emerald-400 text-sm block">
                            {currencySymbol}{Math.round(highestRoiItem.unitProfit)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background/70 border border-border/40 space-y-0.5">
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Stock Turnover
                          </span>
                          <span className="font-bold text-foreground text-sm block">
                            {highestRoiItem.turnover.toFixed(1)}x
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-foreground/90 flex items-start gap-2 leading-relaxed">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Delivers the highest return ({highestRoiItem?.roi.toFixed(0)}% ROI) for every rupee invested in stock. Prioritize in reorders.
                  </span>
                </div>
              </div>
            </div>
          ) : activeTab === 'revenue' ? (
            /* REVENUE TAB */
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
                <h4 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Revenue Drivers & Catalog Demand Insights
                </h4>
                <ul className="space-y-1.5 text-foreground/90 list-disc pl-4 text-xs font-normal">
                  <li>
                    <span className="font-semibold text-foreground">Total Revenue Generated:</span> {currencySymbol}{Math.round(totalBusinessRevenue).toLocaleString('en-IN')} across active catalog transactions.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Top Catalog Asset:</span> {highestRevenueItem?.product.name || 'Catalog Item'} ({currencySymbol}{highestRevenueItem?.product.price}).
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Active Products:</span> {products.length} items loaded in inventory.
                  </li>
                </ul>
              </div>

              <div className="divide-y divide-border/40 rounded-2xl border border-border/40 overflow-hidden bg-secondary/20">
                {productMetrics.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="p-3.5 flex items-start sm:items-center justify-between gap-2 hover:bg-secondary/40 transition-colors">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.product.stock} units • Cost: {currencySymbol}{Math.round(item.unitCost)}</p>
                    </div>
                    <span className="font-bold text-primary text-sm shrink-0">{currencySymbol}{Math.round(item.product.price).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* PRODUCT PERFORMANCE TAB */
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-secondary/40 border border-border/40 space-y-2">
                <h4 className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                  <Layers className="w-4 h-4 text-primary" />
                  Executive Product Performance & Supplier Margin Impact
                </h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Combined catalog view evaluating how supplier purchase costs directly impact product profit margins.
                </p>
              </div>

              <div className="divide-y divide-border/40 rounded-2xl border border-border/40 overflow-hidden bg-secondary/20 text-xs">
                {productMetrics.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-secondary/40 transition-colors">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground truncate text-sm">{item.product.name}</span>
                        <Badge variant="outline" className="text-xs px-2 py-0.5 border-primary/30 text-primary font-medium whitespace-nowrap shrink-0">
                          {item.margin > 30 ? 'Top Performer' : item.margin < 15 ? 'Needs Attention' : 'Best Seller'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Price: {currencySymbol}{item.product.price} • Margin: {item.margin.toFixed(0)}% • Stock: {item.product.stock} units
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-bold block text-sm ${item.unitProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.unitProfit >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(Math.round(item.unitProfit)).toLocaleString('en-IN')} / unit
                      </span>
                      <span className={`text-xs ${item.unitRoi >= 0 ? 'text-muted-foreground' : 'text-rose-400'}`}>
                        {item.unitRoi >= 0 ? '+' : ''}{item.unitRoi.toFixed(0)}% ROI
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
