'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { computeInventoryQuality } from '@/lib/command-center-engine';
import { useData } from '@/context/data-context';
import { Boxes, PackageCheck, AlertTriangle, XCircle, Flame, Clock } from 'lucide-react';

export function InventoryQualitySnapshot() {
  const { products, transactions, businessProfile, capabilities, dataReadiness } = useData();

  const isDeadStockActive = capabilities?.deadStockDetection ?? false;
  const isVelocityActive = capabilities?.slowMoverDetection ?? false;

  const quality = React.useMemo(() => {
    return computeInventoryQuality(products, transactions, {
      isDeadStockEnabled: isDeadStockActive,
      isVelocityEnabled: isVelocityActive,
    });
  }, [products, transactions, isDeadStockActive, isVelocityActive]);

  const currencySymbol = businessProfile?.currency?.includes('USD') ? '$' : '₹';

  return (
    <Card className="ios-glass rounded-3xl border-border/50 p-5 shadow-xl space-y-4 h-full flex flex-col justify-between">
      <div>
        <CardHeader className="p-0 pb-3 border-b border-border/40 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Boxes className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold whitespace-nowrap">Inventory Quality Snapshot</CardTitle>
              <CardDescription className="text-xs truncate">Asset health & catalog composition analytics</CardDescription>
            </div>
          </div>

          <Badge variant="outline" className="text-xs font-semibold whitespace-nowrap shrink-0 px-2.5 py-1">
            {products.length} Total SKUs
          </Badge>
        </CardHeader>

        <CardContent className="p-0 pt-3 space-y-4 text-xs">
          {/* Quality Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-emerald-400" /> Healthy Stock
              </span>
              <p className="text-2xl font-extrabold text-emerald-400">{quality.healthyCount}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Low Stock
              </span>
              <p className="text-2xl font-extrabold text-amber-400">{quality.lowStockCount}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 space-y-1">
              <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-400" /> Out of Stock
              </span>
              <p className="text-2xl font-extrabold text-rose-400">{quality.criticalStockCount}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-500/10 border border-slate-500/25 space-y-1 overflow-hidden">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Dead Stock</span>
              </span>
              <div className="flex items-baseline gap-2 pt-0.5">
                <p className="text-2xl font-extrabold text-slate-300">
                  {isDeadStockActive ? quality.deadStockCount : 0}
                </p>
                {!isDeadStockActive && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 whitespace-nowrap">
                    Observing
                  </span>
                )}
              </div>
              {!isDeadStockActive && (
                <p className="text-[10px] text-muted-foreground truncate" title={`Requires 30d baseline (${dataReadiness?.historicalDays || 0}/30d)`}>
                  Requires 30d baseline ({dataReadiness?.historicalDays || 0}/30d)
                </p>
              )}
            </div>
          </div>

          {/* Top Valuable Products Table */}
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Flame className="w-4 h-4 text-amber-400" /> Top 5 Highest Value Capital Assets
            </h4>

            <div className="divide-y divide-border/40 rounded-2xl border border-border/40 overflow-hidden bg-secondary/20">
              {quality.topValuableProducts.map((p, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-secondary/40 transition-colors">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground truncate max-w-[220px]">{p.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{p.sku} • {p.stock} units</p>
                  </div>
                  <span className="font-bold text-emerald-400">{currencySymbol}{Math.round(p.value).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
