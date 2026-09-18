'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { computeExecutiveKPIs } from '@/lib/command-center-engine';
import { useData } from '@/context/data-context';
import { IndianRupee, CreditCard, ArrowUpRight, ArrowDownRight, Package, ShoppingCart, Clock, TrendingUp } from 'lucide-react';

export function ExecutiveKPIGrid() {
  const { products, transactions, businessProfile, analyticsSummary, orders } = useData();

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  const kpis = React.useMemo(() => {
    // 1. If live products or transactions exist in memory from Firestore, calculate dynamically in real time
    if (transactions.length > 0 || products.length > 0) {
      return computeExecutiveKPIs(products, transactions, businessProfile);
    }

    // 2. Fallback only if live collections are completely empty but a precalculated summary exists
    if (analyticsSummary && (analyticsSummary.totalProducts > 0 || analyticsSummary.totalTransactions > 0)) {
      const recRev = analyticsSummary.recognizedRevenue || analyticsSummary.totalRevenue || 0;
      const pendingVal = analyticsSummary.pendingOrderValue || 0;
      const pendingCount = analyticsSummary.pendingOrderCount || (pendingVal > 0 ? 1 : 0);
      const totalOrdersCount = analyticsSummary.totalOrders || orders?.length || transactions.filter(t => (t.type || '').toLowerCase() === 'sale').length || 0;
      const profit = analyticsSummary.realizedProfit !== undefined && analyticsSummary.realizedProfit > 0
        ? analyticsSummary.realizedProfit
        : (analyticsSummary.grossProfit || Math.round(recRev * 0.35));
      const marginPct = recRev > 0 ? Math.round((profit / recRev) * 100) : 35;

      return [
        {
          key: 'revenue',
          title: 'Recognized Revenue',
          value: `${currencySymbol}${Math.round(recRev).toLocaleString('en-IN')}`,
          rawValue: recRev,
          change: '+100%',
          isPositiveChange: recRev >= 0,
          interpretation: recRev > 0 ? 'Realized on fulfilled & delivered orders.' : 'Awaiting fulfillment/delivery to recognize.',
        },
        {
          key: 'pending_orders',
          title: 'Pending Orders (Pipeline)',
          value: `${currencySymbol}${Math.round(pendingVal).toLocaleString('en-IN')}`,
          rawValue: pendingVal,
          count: pendingCount,
          countLabel: `${pendingCount} ${pendingCount === 1 ? 'Order' : 'Orders'}`,
          change: `${pendingCount} In Queue`,
          isPositiveChange: true,
          interpretation: pendingCount > 0 ? `${pendingCount} placed ${pendingCount === 1 ? 'order' : 'orders'} awaiting fulfillment.` : 'Zero unfulfilled orders in queue.',
        },
        {
          key: 'total_orders',
          title: 'Total Orders',
          value: `${totalOrdersCount.toLocaleString('en-IN')}`,
          rawValue: totalOrdersCount,
          change: '+100%',
          isPositiveChange: true,
          interpretation: 'Confirmed orders across all sales channels.',
        },
        {
          key: 'net_profit',
          title: 'Realized Gross Profit',
          value: `${currencySymbol}${Math.round(profit).toLocaleString('en-IN')}`,
          rawValue: profit,
          change: `${marginPct}% Margin`,
          isPositiveChange: profit >= 0,
          interpretation: recRev > 0 ? `${marginPct}% gross margin on delivered sales.` : 'Calculated after COGS on delivered sales.',
        },
      ];
    }

    // 3. Dynamic calculation from current state
    return computeExecutiveKPIs(products, transactions, businessProfile);
  }, [analyticsSummary, products, transactions, businessProfile, orders, currencySymbol]);

  const getIcon = (key: string) => {
    switch (key) {
      case 'revenue':
        return <IndianRupee className="w-4 h-4 text-emerald-500" />;
      case 'pending_orders':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'total_orders':
      case 'payments_received':
        return <ShoppingCart className="w-4 h-4 text-blue-500" />;
      case 'net_profit':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      default:
        return <ShoppingCart className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.key} className="ios-glass rounded-2xl border-border/50 hover:border-primary/40 transition-all p-4">
          <CardHeader className="p-0 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground">{kpi.title}</CardTitle>
            <div className="p-2 rounded-xl bg-secondary/80 border border-border/40">
              {getIcon(kpi.key)}
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-1.5 pt-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</div>
              <Badge
                className={
                  kpi.key === 'pending_orders'
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/25 text-[10px] font-semibold whitespace-nowrap px-2 py-0.5'
                    : kpi.isPositiveChange
                    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20 text-[10px] whitespace-nowrap gap-0.5'
                    : 'bg-rose-500/15 text-rose-500 border-rose-500/20 text-[10px] whitespace-nowrap gap-0.5'
                }
              >
                {kpi.key !== 'pending_orders' && (kpi.isPositiveChange ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
                {kpi.change}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">{kpi.interpretation}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
